from collections.abc import Mapping
from datetime import datetime, time, timedelta
from rest_framework.exceptions import ValidationError
from apps.users.services.security_otp import rate_limit
from .services.reports import CLOSED
from .report_serializers import ReportFilterSerializer
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q, Exists, OuterRef
from django.utils import timezone
from .models import CitizenRequestAttachment


class ReportPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


class ReportMutationMixin:
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            if not isinstance(request.data, Mapping):
                raise ValidationError('Un objet JSON ou un formulaire est requis.')
            rate_limit(f'report-mutation:{request.user.pk}', 60, 3600)
            if request.method == 'POST' and request.path.rstrip('/') in ('/api/citizen/reports','/api/citizen/requests'):
                rate_limit(f'report-create:{request.user.pk}', 10, 3600)

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store'
        return response

    def handle_exception(self, exc):
        from rest_framework.exceptions import APIException
        from django.http import Http404
        from django.core.exceptions import PermissionDenied
        if isinstance(exc, (APIException, Http404, PermissionDenied)):
            return super().handle_exception(exc)
        import logging
        from rest_framework.response import Response
        logging.getLogger(__name__).exception('Erreur dans le parcours de signalement')
        return Response({'detail': 'Une erreur interne est survenue.'}, status=500)


def filter_local_date_range(queryset, field, date_from=None, date_to=None):
    """Filter a DateTimeField using Nova Terra's local calendar days.

    Explicit aware datetime bounds are used instead of ``__date`` lookups so
    SQLite CI and cPanel MySQL/MariaDB behave identically even when the DB
    server has no timezone tables installed.
    """
    current_tz = timezone.get_current_timezone()
    if date_from is not None:
        start = timezone.make_aware(datetime.combine(date_from, time.min), current_tz)
        queryset = queryset.filter(**{f"{field}__gte": start})
    if date_to is not None:
        exclusive_end = timezone.make_aware(
            datetime.combine(date_to + timedelta(days=1), time.min), current_tz
        )
        queryset = queryset.filter(**{f"{field}__lt": exclusive_end})
    return queryset


def filter_requests(queryset, params, *, citizen=False):
    serializer = ReportFilterSerializer(data={name: params.get(name) for name in params})
    serializer.is_valid(raise_exception=True)
    filters = serializer.validated_data
    for parameter, lookup in (('status', 'status'), ('type', 'request_type'),
        ('priority', 'priority'), ('severity', 'severity'), ('incident_category', 'incident_category__iexact'),
        ('district', 'district__iexact')):
        if parameter in filters:
            queryset = queryset.filter(**{lookup: filters[parameter]})
    queryset = filter_local_date_range(
        queryset,
        'created_at',
        filters.get('created_from'),
        filters.get('created_to'),
    )
    if 'has_images' in filters:
        images = CitizenRequestAttachment.objects.filter(request_id=OuterRef('pk'))
        if citizen:
            images = images.filter(is_public=True).filter(Q(event__isnull=True)|Q(event__is_public=True))
        queryset = queryset.annotate(_has_images=Exists(images)).filter(_has_images=filters['has_images'])
    if filters.get('search'):
        text = filters['search']
        queryset = queryset.filter(Q(reference__icontains=text)|Q(title__icontains=text)|Q(description__icontains=text)|Q(location_text__icontains=text)|Q(service__name__icontains=text))
    return queryset.prefetch_related('attachments__uploader', 'attachments__event').order_by(filters.get('ordering', '-created_at'), '-id')
