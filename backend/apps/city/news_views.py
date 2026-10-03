import uuid
from django.db import transaction
from django.db.models import Q, Count
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from rest_framework import generics, parsers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from helpers.permissions import IsAuthenticatedAdmin
from .models import NewsArticle
from .news_serializers import PublicationSerializer, PublicationAdminSerializer, NewsFilterSerializer, NewsCoverUploadSerializer, NewsDeliveryStatusSerializer
from .services.news import active_news, ordered_news
from .services.audit import record_staff_audit
from .report_api import ReportPagination


class PublicationHeaders:
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response


def filtered_news(queryset, params, admin=False):
    serializer = NewsFilterSerializer(data={k: params.get(k) for k in params})
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    for name in ('category', 'publication_type', 'severity'):
        if name in data:
            queryset = queryset.filter(**{name+'__iexact': data[name]})
    if 'important' in data:
        queryset = queryset.filter(is_important=data['important'])
    if data.get('search'):
        value = data['search']
        queryset = queryset.filter(Q(title__icontains=value) | Q(excerpt__icontains=value) | Q(content__icontains=value) | Q(instructions__icontains=value))
    if data.get('district'):
        district = data['district'].strip().casefold()
        queryset = queryset.filter(Q(district_targets__district=district) | Q(district_targets__isnull=True)).distinct()
    if admin:
        if 'published' in data:
            queryset = queryset.filter(is_published=data['published'])
        state, now = data.get('state'), timezone.now()
        if state == 'draft': queryset = queryset.filter(is_published=False)
        if state == 'scheduled': queryset = queryset.filter(is_published=True, published_at__gt=now)
        if state == 'published': queryset = queryset.filter(active_news(now))
        if state == 'expired': queryset = queryset.filter(is_published=True, expires_at__lte=now)
    return ordered_news(queryset)


@method_decorator(name='get', decorator=swagger_auto_schema(query_serializer=NewsFilterSerializer))
class NewsListView(PublicationHeaders, generics.ListAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = PublicationSerializer
    pagination_class = ReportPagination

    def get_queryset(self):
        return filtered_news(NewsArticle.objects.filter(active_news()), self.request.query_params)


class NewsDetailView(PublicationHeaders, generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = PublicationSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        return NewsArticle.objects.filter(active_news())


class ActiveAlertListView(NewsListView):
    def get_queryset(self):
        return super().get_queryset().filter(publication_type='alert')


@method_decorator(name='get', decorator=swagger_auto_schema(query_serializer=NewsFilterSerializer))
class AdminNewsListCreateView(PublicationHeaders, generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = PublicationAdminSerializer
    pagination_class = ReportPagination
    parser_classes = [parsers.JSONParser]

    def get_queryset(self):
        return filtered_news(NewsArticle.objects.all(), self.request.query_params, admin=True)

    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save(author=self.request.user)
        record_staff_audit(
            actor=self.request.user, action="publication.create", resource_type="publication",
            resource_id=instance.pk, resource_reference=instance.slug,
            summary="Publication municipale créée",
            changes={"publication_type": instance.publication_type, "is_published": instance.is_published},
            request=self.request,
        )


class AdminNewsDetailView(PublicationHeaders, generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = PublicationAdminSerializer
    parser_classes = [parsers.JSONParser]
    lookup_field = 'slug'
    queryset = NewsArticle.objects.all()
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        self.queryset = NewsArticle.objects.select_for_update()
        return super().update(request, *args, **kwargs)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        self.queryset = NewsArticle.objects.select_for_update()
        return super().destroy(request, *args, **kwargs)

    def perform_update(self, serializer):
        instance = serializer.instance
        tracked = ('title', 'publication_type', 'severity', 'is_published', 'published_at', 'expires_at', 'is_important', 'service_id')
        previous = {field: getattr(instance, field) for field in tracked}
        instance = serializer.save()
        changed = [field for field in tracked if previous[field] != getattr(instance, field)]
        if changed:
            record_staff_audit(
                actor=self.request.user, action="publication.update", resource_type="publication",
                resource_id=instance.pk, resource_reference=instance.slug,
                summary="Publication municipale modifiée", changes={"fields": changed},
                request=self.request,
            )

    def perform_destroy(self, instance):
        was_published = instance.is_published
        instance.is_published = False
        instance.save(update_fields=['is_published', 'updated_at'])
        record_staff_audit(
            actor=self.request.user, action="publication.unpublish", resource_type="publication",
            resource_id=instance.pk, resource_reference=instance.slug,
            summary="Publication municipale dépubliée",
            changes={"is_published": {"from": was_published, "to": False}}, request=self.request,
        )


class NewsCoverView(PublicationHeaders, APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @swagger_auto_schema(responses={200: openapi.Response('Image normalisée', schema=openapi.Schema(type=openapi.TYPE_FILE))})
    def get(self, request, slug):
        article = get_object_or_404(NewsArticle.objects.filter(active_news()), slug=slug)
        if not article.cover_image:
            raise Http404
        try:
            response = FileResponse(article.cover_image.open('rb'), content_type='image/png' if article.cover_image.name.endswith('.png') else 'image/jpeg')
        except FileNotFoundError:
            raise Http404
        response['X-Content-Type-Options'] = 'nosniff'
        return response


class AdminNewsCoverView(PublicationHeaders, APIView):
    permission_classes = [IsAuthenticatedAdmin]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def get(self, request, slug):
        article = get_object_or_404(NewsArticle, slug=slug)
        if not article.cover_image:
            raise Http404
        try:
            response = FileResponse(article.cover_image.open('rb'), content_type='image/png' if article.cover_image.name.endswith('.png') else 'image/jpeg')
        except FileNotFoundError:
            raise Http404
        response['X-Content-Type-Options'] = 'nosniff'
        return response

    @swagger_auto_schema(request_body=NewsCoverUploadSerializer, responses={200: PublicationAdminSerializer})
    def post(self, request, slug):
        serializer = NewsCoverUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        storage, saved = None, None
        try:
            with transaction.atomic():
                article = get_object_or_404(NewsArticle.objects.select_for_update(), slug=slug)
                old = article.cover_image.name
                image = serializer.validated_data['image']
                article.cover_image.save(uuid.uuid4().hex + ('.png' if image.name.endswith('.png') else '.jpg'), image, save=False)
                storage, saved = article.cover_image.storage, article.cover_image.name
                article.cover_alt = serializer.validated_data['cover_alt']
                article.save(update_fields=['cover_image', 'cover_alt', 'updated_at'])
                record_staff_audit(
                    actor=request.user, action="publication.cover_update", resource_type="publication",
                    resource_id=article.pk, resource_reference=article.slug,
                    summary="Illustration de publication mise à jour", changes={"cover_image": "updated"},
                    request=request,
                )
                if old:
                    transaction.on_commit(lambda: storage.delete(old), robust=True)
        except Exception:
            if saved: storage.delete(saved)
            raise
        return Response(PublicationAdminSerializer(article, context={'request': request}).data)

    @transaction.atomic
    def delete(self, request, slug):
        article = get_object_or_404(NewsArticle.objects.select_for_update(), slug=slug)
        old, storage = article.cover_image.name, article.cover_image.storage
        article.cover_image = ''
        article.cover_alt = ''
        article.save(update_fields=['cover_image', 'cover_alt', 'updated_at'])
        record_staff_audit(
            actor=request.user, action="publication.cover_delete", resource_type="publication",
            resource_id=article.pk, resource_reference=article.slug,
            summary="Illustration de publication supprimée", changes={"cover_image": "removed"},
            request=request,
        )
        if old: transaction.on_commit(lambda: storage.delete(old), robust=True)
        return Response(status=204)


class AdminNewsDeliveryView(PublicationHeaders, APIView):
    permission_classes = [IsAuthenticatedAdmin]

    @swagger_auto_schema(responses={200: NewsDeliveryStatusSerializer})
    def get(self, request, slug):
        item = get_object_or_404(NewsArticle, slug=slug)
        notices = item.notifications.all()
        return Response({'started_at': item.delivery_started_at, 'completed_at': item.delivery_completed_at,
            'recipients': notices.count(), 'read': notices.filter(is_read=True).count(),
            'emails_sent': notices.filter(email_sent_at__isnull=False).count(),
            'emails_pending': notices.filter(is_important=True, email_sent_at__isnull=True).count(),
            'emails_failed': notices.exclude(email_last_error='').count()})
