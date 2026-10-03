from django.db import transaction
from django.utils.decorators import method_decorator
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from helpers.permissions import IsAuthenticatedCitizen, IsAuthenticatedAgent, IsAuthenticatedAdmin
from .models import CitizenRequest, CitizenRequestAttachment, CitizenRequestEvent, MunicipalService
from .serializers import CitizenRequestDetailSerializer, CitizenIssueReportSerializer, CitizenRequestEventSerializer
from .report_serializers import (RequestAttachmentSerializer, AttachmentUploadSerializer,
    AttachmentCaptionSerializer, CitizenReportMessageSerializer, ReportReasonSerializer)
from .report_api import ReportMutationMixin, ReportPagination, filter_requests
from .services.reports import (CATEGORIES, CLOSED, attachment_transaction, save_images,
    event, notify_staff, notify_citizen)

from .report_swagger import (
    report_categories_schema, report_summary_schema, report_detail_schema, report_edit_schema,
    report_reason_schema, agent_report_reopen_schema, report_messages_get_schema, report_messages_post_schema,
    report_attachments_get_schema, report_attachments_post_schema, report_attachment_get_schema,
    report_attachment_patch_schema, report_attachment_delete_schema, report_image_download_schema,
)

STAFF = IsAuthenticatedAgent | IsAuthenticatedAdmin
ANY_ROLE = IsAuthenticatedCitizen | IsAuthenticatedAgent | IsAuthenticatedAdmin


def is_staff(user):
    return user.role in ('agent', 'admin') or user.is_superuser


def report_for(request, reference, *, staff=False, lock=False):
    queryset = CitizenRequest.objects.select_for_update() if lock else CitizenRequest.objects
    queryset = queryset.filter(request_type='report')
    if not staff:
        queryset = queryset.filter(citizen=request.user)
    return get_object_or_404(queryset, reference=reference)


def assert_open(item):
    if item.status in CLOSED:
        raise ValidationError('Ce signalement est clôturé. Réouvrez-le avant de le compléter.')


@method_decorator(name="get", decorator=report_categories_schema)
class ReportCategoryView(ReportMutationMixin, APIView):
    permission_classes = [ANY_ROLE]

    def get(self, request):
        services = {service.slug: service for service in MunicipalService.objects.filter(is_active=True)}
        rows = []
        for category in CATEGORIES:
            service = services.get(category['service_slug'])
            rows.append({'code': category['code'], 'label': category['label'],
                'suggested_service': service.pk if service else None,
                'suggested_service_name': service.name if service else None,
                'needs_triage': service is None})
        return Response({'categories': rows, 'limits': {'images_per_upload': 10,
            'images_per_request': 20, 'image_max_bytes': 8388608, 'image_max_pixels': 20000000,
            'accepted_formats': ['JPEG', 'PNG', 'WebP']},
            'location_rule': 'location_text ou latitude et longitude',
            'danger_guidance': 'Le signalement municipal ne remplace pas une demande d’intervention aux services d’urgence.'})


@method_decorator(name="get", decorator=report_detail_schema)
@method_decorator(name="patch", decorator=report_edit_schema)
class CitizenReportDetailView(ReportMutationMixin, generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    http_method_names = ['get', 'patch', 'head', 'options']
    lookup_field = 'reference'

    def get_serializer_class(self):
        return CitizenIssueReportSerializer if self.request.method == 'PATCH' else CitizenRequestDetailSerializer

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return CitizenRequest.objects.none()
        return CitizenRequest.objects.filter(citizen=self.request.user, request_type='report').select_related('citizen','service','assigned_to').prefetch_related('attachments__uploader','attachments__event')

    def patch(self, request, *args, **kwargs):
        with attachment_transaction():
            item = report_for(request, kwargs['reference'], lock=True)
            if item.status not in ('submitted', 'pending'):
                raise ValidationError('La description initiale ne peut être modifiée qu’avant le traitement. Ajoutez un complément au dossier.')
            serializer = CitizenIssueReportSerializer(item, data=request.data, partial=True, context={'request': request})
            serializer.is_valid(raise_exception=True)
            serializer.save()
            event(item, request.user, 'Signalement corrigé', 'Le citoyen a complété les informations initiales.')
            notify_staff(item, request.user, 'Les informations du signalement ont été corrigées.')
        return Response(CitizenRequestDetailSerializer(item, context={'request': request}).data)


@method_decorator(name="get", decorator=report_summary_schema)
class CitizenReportSummaryView(ReportMutationMixin, APIView):
    permission_classes = [IsAuthenticatedCitizen]

    def get(self, request):
        queryset = CitizenRequest.objects.filter(citizen=request.user, request_type='report')
        counts = dict(queryset.values_list('status').annotate(total=Count('id')))
        return Response({'total': queryset.count(), 'open': queryset.exclude(status__in=CLOSED).count(),
            'by_status': {code: counts.get(code, 0) for code, _ in CitizenRequest.Status.choices},
            'needs_information': counts.get('action_required', 0),
            'needs_triage': queryset.filter(service__isnull=True).exclude(status__in=CLOSED).count()})


@method_decorator(name="get", decorator=report_messages_get_schema)
@method_decorator(name="post", decorator=report_messages_post_schema)
class CitizenReportMessageView(ReportMutationMixin, generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    pagination_class = ReportPagination

    def get_serializer_class(self):
        return CitizenReportMessageSerializer if self.request.method == 'POST' else CitizenRequestEventSerializer

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return CitizenRequestEvent.objects.none()
        item = report_for(self.request, self.kwargs['reference'])
        return item.timeline_events.filter(is_public=True).select_related('actor').prefetch_related('attachments__uploader','attachments__event')

    def post(self, request, reference):
        with attachment_transaction():
            item = report_for(request, reference, lock=True)
            assert_open(item)
            serializer = CitizenReportMessageSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data
            old = item.status
            if old == 'action_required':
                item.status = 'in_progress' if item.assigned_to_id else 'pending'
            item.save(update_fields=['status','updated_at'])
            note = event(item, request.user, 'Complément citoyen', data.get('message', ''))
            save_images(item, data.get('images', []), uploader=request.user, event=note, captions=data.get('image_captions'))
            if old != item.status:
                event(item, request.user, 'Informations transmises', 'Le dossier est de nouveau à examiner.', kind='status')
            notify_staff(item, request.user, 'Un complément citoyen a été ajouté au signalement.')
        return Response(CitizenRequestEventSerializer(note, context={'request': request}).data, status=201)


@method_decorator(name="post", decorator=report_reason_schema)
class CitizenReportCancelView(ReportMutationMixin, APIView):
    permission_classes = [IsAuthenticatedCitizen]

    def post(self, request, reference):
        serializer = ReportReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            item = report_for(request, reference, lock=True)
            assert_open(item)
            item.status = 'cancelled'
            item.cancellation_reason = serializer.validated_data['reason']
            item.closed_at = timezone.now()
            item.save(update_fields=['status','cancellation_reason','closed_at','updated_at'])
            event(item, request.user, 'Signalement annulé', item.cancellation_reason, kind='status')
            notify_staff(item, request.user, 'Le citoyen a annulé son signalement.')
            notify_citizen(item, request.user, 'Votre signalement a été annulé.')
        return Response(CitizenRequestDetailSerializer(item, context={'request': request}).data)


@method_decorator(name="post", decorator=report_reason_schema)
class CitizenReportReopenView(ReportMutationMixin, APIView):
    permission_classes = [IsAuthenticatedCitizen]

    def post(self, request, reference):
        serializer = ReportReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            item = report_for(request, reference, lock=True)
            if item.status not in ('completed', 'rejected'):
                raise ValidationError('Seul un signalement résolu ou non retenu peut être réouvert.')
            item.status = 'pending'
            item.closed_at = item.resolved_at = None
            item.resolution_summary = ''
            item.reopened_count += 1
            item.save(update_fields=['status','closed_at','resolved_at','resolution_summary','reopened_count','updated_at'])
            event(item, request.user, 'Signalement réouvert', serializer.validated_data['reason'], kind='status')
            notify_staff(item, request.user, 'Le citoyen signale que le problème persiste.')
            notify_citizen(item, request.user, 'Votre signalement est de nouveau à examiner.')
        return Response(CitizenRequestDetailSerializer(item, context={'request': request}).data)


@method_decorator(name="get", decorator=report_attachments_get_schema)
@method_decorator(name="post", decorator=report_attachments_post_schema)
class ReportAttachmentListView(ReportMutationMixin, generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    staff_space = False
    pagination_class = ReportPagination

    def get_serializer_class(self):
        return AttachmentUploadSerializer if self.request.method == 'POST' else RequestAttachmentSerializer

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return CitizenRequestAttachment.objects.none()
        item = report_for(self.request, self.kwargs['reference'], staff=self.staff_space)
        queryset = item.attachments.select_related('uploader','event')
        if not self.staff_space:
            queryset = queryset.filter(is_public=True).filter(Q(event__isnull=True)|Q(event__is_public=True))
        return queryset

    def post(self, request, reference):
        with attachment_transaction():
            item = report_for(request, reference, staff=self.staff_space, lock=True)
            assert_open(item)
            serializer = AttachmentUploadSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data
            public = data['is_public'] if self.staff_space else True
            note = event(item, request.user, 'Photos ajoutées', 'De nouvelles photos complètent le dossier.', public=public)
            images = save_images(item, data['images'], uploader=request.user, event=note,
                                 is_public=public, captions=data.get('image_captions'))
            item.save(update_fields=['updated_at'])
            if self.staff_space and public:
                notify_citizen(item, request.user, 'Des photos ont été ajoutées au dossier.')
            elif not self.staff_space:
                notify_staff(item, request.user, 'Le citoyen a ajouté des photos au dossier.')
        return Response({'attachments': RequestAttachmentSerializer(images, many=True, context={'request': request}).data}, status=201)


class AgentReportAttachmentListView(ReportAttachmentListView):
    permission_classes = [STAFF]
    staff_space = True


@method_decorator(name="get", decorator=report_attachment_get_schema)
@method_decorator(name="patch", decorator=report_attachment_patch_schema)
@method_decorator(name="delete", decorator=report_attachment_delete_schema)
class ReportAttachmentDetailView(ReportMutationMixin, APIView):
    permission_classes = [ANY_ROLE]

    def attachment(self, request, pk, *, lock=False):
        images = CitizenRequestAttachment.objects.select_for_update() if lock else CitizenRequestAttachment.objects
        images = images.select_related('request','event','uploader')
        if not is_staff(request.user):
            images = images.filter(request__citizen=request.user, is_public=True).filter(Q(event__isnull=True)|Q(event__is_public=True))
        return get_object_or_404(images, pk=pk)

    def get(self, request, pk):
        return Response(RequestAttachmentSerializer(self.attachment(request, pk), context={'request': request}).data)

    def change(self, request, pk, delete=False):
        with transaction.atomic():
            # Lock parent before attachment, consistent with upload/delete ordering.
            initial = self.attachment(request, pk)
            item = CitizenRequest.objects.select_for_update().get(pk=initial.request_id)
            proof = self.attachment(request, pk, lock=True)
            if proof.uploader_id != request.user.pk:
                raise PermissionDenied('Vous pouvez modifier uniquement vos propres photos.')
            assert_open(item)
            if not is_staff(request.user) and item.status not in ('submitted','pending'):
                raise ValidationError('Les preuves transmises ne peuvent plus être retirées pendant le traitement.')
            if delete:
                name = proof.original_name
                event(item, request.user, 'Photo retirée', 'Une photo a été retirée par son auteur.', public=proof.is_public)
                proof.delete()
            else:
                serializer = AttachmentCaptionSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                proof.caption = serializer.validated_data['caption']
                proof.save(update_fields=['caption'])
                event(item, request.user, 'Légende de photo corrigée', public=proof.is_public)
            item.save(update_fields=['updated_at'])
        return Response(status=204) if delete else Response(RequestAttachmentSerializer(proof, context={'request': request}).data)

    def patch(self, request, pk):
        return self.change(request, pk)

    def delete(self, request, pk):
        return self.change(request, pk, delete=True)


@method_decorator(name="get", decorator=report_image_download_schema)
class ReportImageDownloadView(ReportAttachmentDetailView):
    http_method_names = ['get','head','options']

    def get(self, request, pk):
        proof = self.attachment(request, pk)
        try:
            handle = proof.image.open('rb')
        except FileNotFoundError:
            from django.http import Http404
            raise Http404('Image indisponible.')
        response = FileResponse(handle, content_type=proof.content_type,
                                filename='proof.png' if proof.content_type == 'image/png' else 'proof.jpg')
        response['X-Content-Type-Options'] = 'nosniff'
        response['Cache-Control'] = 'private, no-store'
        response['Cross-Origin-Resource-Policy'] = 'same-site'
        return response


@method_decorator(name="post", decorator=agent_report_reopen_schema)
class AgentReportReopenView(ReportMutationMixin, APIView):
    permission_classes = [STAFF]

    def post(self, request, reference):
        serializer = ReportReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            item = report_for(request, reference, staff=True, lock=True)
            if item.status not in ('completed', 'rejected'):
                raise ValidationError('Seul un dossier résolu ou non retenu peut être réouvert.')
            item.status = 'pending'
            item.closed_at = item.resolved_at = None
            item.resolution_summary = ''
            item.reopened_count += 1
            item.save(update_fields=['status','closed_at','resolved_at','resolution_summary','reopened_count','updated_at'])
            event(item, request.user, 'Dossier réouvert par le service', serializer.validated_data['reason'], kind='status')
            notify_citizen(item, request.user, serializer.validated_data['reason'], important=True)
        from .serializers import AgentCitizenRequestDetailSerializer
        return Response(AgentCitizenRequestDetailSerializer(item, context={'request': request}).data)
