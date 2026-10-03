from .news_views import NewsListView, NewsDetailView, AdminNewsListCreateView, AdminNewsDetailView
from .services.news import visible_notifications, active_news
import uuid
from datetime import date, datetime, time, timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Count, F, Q
from django.utils import timezone
from django.utils.decorators import method_decorator
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import User
from apps.realtime.services import publish_after_commit, role_group, user_group
from helpers.permissions import (
    IsAuthenticatedAdmin,
    IsAuthenticatedAgent,
    IsAuthenticatedCitizen,
)

from .models import (
    CitizenAppointment,
    CitizenNotification,
    CitizenPreference,
    CitizenRequest,
    CitizenRequestEvent,
    ContactMessage,
    MunicipalService,
    NewsArticle,
    StaffAuditEvent,
    WebCupRequestSnapshot,
    WebCupSyncState,
)
from .constants import ONBOARDING_STEPS, SUPPORTED_LANGUAGES
from .serializers import (
    AdminMunicipalServiceSerializer,
    AdminNewsArticleSerializer,
    AdminUserCreateSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
    AgentCitizenRequestDetailSerializer,
    AgentCitizenRequestSerializer,
    AgentAppointmentSerializer,
    AgentRequestEventCreateSerializer,
    AppointmentAgentSerializer,
    CitizenAppointmentSerializer,
    CitizenAppointmentUpdateSerializer,
    AssigneeSerializer,
    CitizenContactMessageSerializer,
    CitizenNotificationSerializer,
    CitizenPreferenceSerializer,
    CitizenRequestDetailSerializer,
    CitizenRequestEventSerializer,
    CitizenIssueReportSerializer,
    CitizenRequestSerializer,
    ContactMessageCreateSerializer,
    ContactMessageReceiptSerializer,
    ContactMessageSerializer,
    MunicipalServiceSerializer,
    ServiceAvailabilityUpdateSerializer,
    NewsArticleSerializer,
    NotificationCreateSerializer,
    SimilarCitizenRequestResponseSerializer,
    StaffAuditEventSerializer,
    WebCupRequestSnapshotSerializer,
)
from .swagger import (
    admin_appointment_list_schema,
    admin_appointment_patch_schema,
    admin_notification_post_schema,
    admin_contact_patch_schema,
    admin_news_delete_schema,
    admin_news_patch_schema,
    admin_news_post_schema,
    admin_request_event_post_schema,
    admin_request_list_schema,
    admin_request_patch_schema,
    admin_request_similar_schema,
    admin_service_delete_schema,
    admin_service_patch_schema,
    admin_service_post_schema,
    service_availability_patch_schema,
    admin_user_patch_schema,
    admin_user_post_schema,
    agent_contact_patch_schema,
    agent_appointment_list_schema,
    agent_appointment_patch_schema,
    agent_audit_list_schema,
    admin_audit_list_schema,
    agent_notification_post_schema,
    agent_request_event_post_schema,
    agent_request_list_schema,
    agent_request_patch_schema,
    agent_request_similar_schema,
    citizen_notification_patch_schema,
    citizen_notification_read_all_schema,
    citizen_appointment_patch_schema,
    citizen_appointment_post_schema,
    citizen_onboarding_patch_schema,
    citizen_preferences_patch_schema,
    citizen_report_post_schema,
    citizen_request_post_schema,
    contact_create_schema,
)
from .services.notifications import schedule_notification_batch, schedule_notification_email
from .services.audit import record_staff_audit
from .report_api import ReportMutationMixin, ReportPagination, filter_local_date_range, filter_requests
from .report_swagger import report_list_schema
from .services.reports import attachment_transaction, CLOSED, event as report_event, notify_citizen as notify_report_citizen
from .services.request_similarity import find_similar_requests
from .services.webcup import WebCupUpstreamError, get_webcup_requests


AGENT_OR_ADMIN = IsAuthenticatedAgent | IsAuthenticatedAdmin
ACTIVE_APPOINTMENT_STATUSES = (
    CitizenAppointment.Status.REQUESTED,
    CitizenAppointment.Status.CONFIRMED,
)
AGENT_ACTION_STATUSES = (
    CitizenRequest.Status.SUBMITTED,
    CitizenRequest.Status.PENDING,
    CitizenRequest.Status.IN_PROGRESS,
)
AWAITING_HANDLING_STATUSES = (
    CitizenRequest.Status.SUBMITTED,
    CitizenRequest.Status.PENDING,
)


def _query_bool(params, name):
    raw = params.get(name)
    if raw is None or raw == "":
        return None
    value = str(raw).strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    raise ValidationError({name: "Utilisez true ou false."})


def _filter_agent_workflow(queryset, params):
    awaiting = _query_bool(params, "awaiting_handling")
    if awaiting is True:
        queryset = queryset.filter(
            status__in=AWAITING_HANDLING_STATUSES,
            acknowledged_at__isnull=True,
        )
    elif awaiting is False:
        queryset = queryset.exclude(
            status__in=AWAITING_HANDLING_STATUSES,
            acknowledged_at__isnull=True,
        )

    needs_action = _query_bool(params, "needs_action")
    if needs_action is True:
        queryset = queryset.filter(status__in=AGENT_ACTION_STATUSES)
    elif needs_action is False:
        queryset = queryset.exclude(status__in=AGENT_ACTION_STATUSES)

    workflow_state = str(params.get("workflow_state", "")).strip().lower()
    if workflow_state:
        if workflow_state == "awaiting_handling":
            queryset = queryset.filter(
                status__in=AWAITING_HANDLING_STATUSES,
                acknowledged_at__isnull=True,
            )
        elif workflow_state == "agent_processing":
            queryset = queryset.filter(status__in=AGENT_ACTION_STATUSES).exclude(
                status__in=AWAITING_HANDLING_STATUSES,
                acknowledged_at__isnull=True,
            )
        elif workflow_state == "citizen_action_required":
            queryset = queryset.filter(status=CitizenRequest.Status.ACTION_REQUIRED)
        elif workflow_state == "closed":
            queryset = queryset.filter(status__in=CLOSED)
        else:
            raise ValidationError({
                "workflow_state": (
                    "Valeurs autorisées : awaiting_handling, agent_processing, "
                    "citizen_action_required, closed."
                )
            })
    return queryset


def _appointment_frontend_url(appointment):
    return f"/appointments/{appointment.reference}"


def _appointment_reminder_message(appointment):
    local_start = timezone.localtime(appointment.starts_at)
    agent_name = appointment.agent.get_full_name().strip() or appointment.agent.email
    details = [
        f"Rendez-vous avec {agent_name} le {local_start:%d/%m/%Y à %H:%M}.",
    ]
    if appointment.location:
        details.append(f"Lieu : {appointment.location}.")
    if appointment.preparation_instructions:
        details.append(appointment.preparation_instructions.strip())
    elif appointment.service and appointment.service.required_documents:
        details.append("Pensez à préparer les documents indiqués pour ce service.")
    return " ".join(details)


def _sync_appointment_reminder(appointment):
    reminders = CitizenNotification.objects.filter(
        user=appointment.citizen,
        related_appointment=appointment,
        notification_code="appointment_reminder",
    )
    if (
        not appointment.reminder_enabled
        or appointment.status not in ACTIVE_APPOINTMENT_STATUSES
    ):
        # Les rappels non lus deviennent inutiles dès qu'un rendez-vous est
        # annulé/refusé/terminé. Les rappels déjà lus restent dans l'historique.
        reminders.filter(is_read=False).delete()
        return None

    now = timezone.now()
    visible_from = appointment.starts_at - timedelta(
        minutes=appointment.reminder_minutes_before
    )
    if visible_from < now:
        visible_from = now

    defaults = {
        "kind": CitizenNotification.Kind.APPOINTMENT,
        "scope": CitizenNotification.Scope.AUTOMATED,
        "title": "Rappel de rendez-vous",
        "message": _appointment_reminder_message(appointment),
        "action_label": "Voir le rendez-vous",
        "action_url": _appointment_frontend_url(appointment),
        "visible_from": visible_from,
        "sender": appointment.agent,
        "is_important": True,
        "is_read": False,
        "read_at": None,
    }
    reminder = reminders.order_by("id").first()
    if reminder:
        for field, value in defaults.items():
            setattr(reminder, field, value)
        reminder.save(update_fields=[*defaults.keys()])
        reminders.exclude(pk=reminder.pk).delete()
        schedule_notification_email(reminder)
        return reminder
    reminder = CitizenNotification.objects.create(
        user=appointment.citizen,
        related_appointment=appointment,
        notification_code="appointment_reminder",
        **defaults,
    )
    schedule_notification_email(reminder)
    return reminder


def _notify_appointment_update(appointment, *, sender, message=None):
    local_start = timezone.localtime(appointment.starts_at)
    if message is None:
        message = (
            f"Votre rendez-vous du {local_start:%d/%m/%Y à %H:%M} est maintenant "
            f"« {appointment.get_status_display()} » ."
        )
    notification = CitizenNotification.objects.create(
        user=appointment.citizen,
        sender=sender,
        scope=CitizenNotification.Scope.TARGETED,
        kind=CitizenNotification.Kind.APPOINTMENT,
        title=f"Rendez-vous {appointment.reference}",
        message=message,
        action_label="Voir le rendez-vous",
        action_url=_appointment_frontend_url(appointment),
        notification_code=f"appointment_update:{uuid.uuid4().hex}",
        related_appointment=appointment,
        is_important=True,
    )
    schedule_notification_email(notification)
    return notification


def _dispatch_manual_notification(*, sender, validated_data):
    audience = validated_data["audience"]
    recipient = validated_data.get("recipient")
    batch_code = f"manual:{uuid.uuid4().hex}"
    common = {
        "sender": sender,
        "scope": (
            CitizenNotification.Scope.GLOBAL
            if audience == "global"
            else CitizenNotification.Scope.TARGETED
        ),
        "kind": CitizenNotification.Kind.SYSTEM,
        "title": validated_data["title"],
        "message": validated_data.get("message", ""),
        "action_label": validated_data.get("action_label", ""),
        "action_url": validated_data.get("action_url", ""),
        "visible_from": validated_data["visible_from"],
        "notification_code": batch_code,
        "is_important": validated_data.get("is_important", False),
    }

    if audience == "targeted":
        notification = CitizenNotification.objects.create(user=recipient, **common)
        schedule_notification_email(notification)
        return 1, batch_code

    citizens = User.objects.filter(role=User.Role.CITIZEN, is_active=True).only("id")
    notifications = [CitizenNotification(user=user, **common) for user in citizens]
    if notifications:
        CitizenNotification.objects.bulk_create(notifications, batch_size=500)
        publish_after_commit(
            groups=[role_group(User.Role.CITIZEN)],
            event="notifications.refresh",
            payload={"reason": "global_notification", "batch_code": batch_code},
        )
        if common["is_important"]:
            schedule_notification_batch(batch_code)
    return len(notifications), batch_code


def _notify_request_status(citizen_request, previous_status=None, *, sender=None):
    if previous_status == citizen_request.status:
        return
    label = citizen_request.get_status_display()
    notification = CitizenNotification.objects.create(
        user=citizen_request.citizen,
        sender=sender or citizen_request.assigned_to,
        scope=CitizenNotification.Scope.TARGETED,
        kind=CitizenNotification.Kind.REQUEST,
        title=f"Demande {citizen_request.reference}",
        message=f"Le statut de votre demande est maintenant : {label}.",
        action_label="Voir la demande",
        action_url=f"/requests/{citizen_request.reference}",
        related_request=citizen_request,
        is_important=True,
    )
    schedule_notification_email(notification)


def _create_request_event(citizen_request, *, actor=None, event_type=None, title=None, message="", is_public=True):
    event_type = event_type or CitizenRequestEvent.EventType.NOTE
    return CitizenRequestEvent.objects.create(
        request=citizen_request,
        actor=actor,
        event_type=event_type,
        status=citizen_request.status,
        title=title or citizen_request.get_status_display(),
        message=message,
        is_public=is_public,
    )


def _register_service_usage(service_id):
    if service_id:
        MunicipalService.objects.filter(pk=service_id).update(usage_count=F("usage_count") + 1)


def _profile_completion(user):
    checks = [
        bool(user.first_name.strip()),
        bool(user.last_name.strip()),
        bool(user.phone_number.strip()),
        bool(user.email_verified),
    ]
    return round(sum(checks) * 100 / len(checks))


def _request_confirmation(instance):
    needs_triage = instance.request_type == CitizenRequest.RequestType.REPORT and not instance.service_id
    return {
        "received": True,
        "message": (
            "Votre signalement est enregistré et sera orienté vers le service compétent."
            if needs_triage
            else "Votre demande a bien été enregistrée et transmise aux services municipaux."
        ),
        "next_step": "triage" if needs_triage else "processing",
        "service": instance.service_id,
        "needs_triage": needs_triage,
        "reference": instance.reference,
        "status": instance.status,
        "created_at": instance.created_at,
    }


# ---------------------------------------------------------------------------
# Public
# ---------------------------------------------------------------------------


class MunicipalServiceListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = MunicipalServiceSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return MunicipalService.objects.none()
        # F64 : un service connu comme indisponible ne doit plus disparaître.
        # Il reste consultable avec son état et les consignes associées.
        queryset = MunicipalService.objects.all()
        available = _query_bool(self.request.query_params, "available")
        if available is not None:
            queryset = queryset.filter(is_active=available)
        category = self.request.query_params.get("category")
        search = self.request.query_params.get("search")
        if category:
            queryset = queryset.filter(category__iexact=category.strip())
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(short_description__icontains=search)
                | Q(description__icontains=search)
            )
        featured = self.request.query_params.get("featured", "").strip().lower()
        if featured in {"1", "true", "yes"}:
            queryset = queryset.filter(is_featured=True)
        ordering = self.request.query_params.get("ordering", "").strip().lower()
        if ordering == "popular":
            return queryset.order_by("-usage_count", "priority_order", "sort_order", "name")
        if ordering == "featured":
            return queryset.order_by("-is_featured", "priority_order", "-usage_count", "sort_order", "name")
        return queryset


class CityLanguageListView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"languages": list(SUPPORTED_LANGUAGES), "default": "fr"})


class MunicipalServiceHighlightsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        try:
            limit = min(max(int(request.query_params.get("limit", 6)), 1), 20)
        except (TypeError, ValueError):
            limit = 6
        base = MunicipalService.objects.filter(is_active=True)
        featured = base.filter(is_featured=True).order_by("priority_order", "-usage_count", "sort_order")[:limit]
        popular = base.order_by("-usage_count", "-is_featured", "priority_order", "sort_order")[:limit]
        context = {"request": request}
        return Response({
            "featured": MunicipalServiceSerializer(featured, many=True, context=context).data,
            "popular": MunicipalServiceSerializer(popular, many=True, context=context).data,
        })


class MunicipalServiceDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = MunicipalServiceSerializer
    lookup_field = "slug"
    queryset = MunicipalService.objects.all()


@method_decorator(name="post", decorator=contact_create_schema)
class ContactMessageCreateView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = ContactMessageCreateSerializer
    throttle_scope = "contact"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        _register_service_usage(instance.service_id)

        if instance.user and getattr(instance.user, "role", None) == User.Role.CITIZEN:
            CitizenNotification.objects.create(
                user=instance.user,
                kind=CitizenNotification.Kind.CONTACT,
                title="Message transmis à la mairie",
                message=f"Votre message {instance.reference} a bien été reçu.",
                related_contact=instance,
            )

        return Response(
            {
                "message": "Message envoyé avec succès.",
                "request": ContactMessageReceiptSerializer(instance).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Citizen
# ---------------------------------------------------------------------------


class CitizenDashboardView(APIView):
    permission_classes = [IsAuthenticatedCitizen]

    def get(self, request):
        requests = CitizenRequest.objects.filter(citizen=request.user)
        appointments = CitizenAppointment.objects.filter(citizen=request.user)
        now = timezone.now()
        return Response(
            {
                "requests": {
                    "total": requests.count(),
                    "pending": requests.filter(status=CitizenRequest.Status.PENDING).count(),
                    "submitted": requests.filter(status=CitizenRequest.Status.SUBMITTED).count(),
                    "in_progress": requests.filter(status=CitizenRequest.Status.IN_PROGRESS).count(),
                    "action_required": requests.filter(status=CitizenRequest.Status.ACTION_REQUIRED).count(),
                    "completed": requests.filter(status=CitizenRequest.Status.COMPLETED).count(),
                },
                "notifications_unread": CitizenNotification.objects.filter(
                    user=request.user, is_read=False, visible_from__lte=now
                ).filter(visible_notifications()).count(),
                "appointments": {
                    "total": appointments.count(),
                    "upcoming": appointments.filter(
                        status__in=ACTIVE_APPOINTMENT_STATUSES,
                        ends_at__gte=now,
                    ).count(),
                },
                "contacts": ContactMessage.objects.filter(user=request.user).count(),
                "profile_completion": _profile_completion(request.user),
                "locale": (request.user.locale or "fr").split("-")[0],
                "onboarding_completed": CitizenPreference.objects.filter(
                    user=request.user, onboarding_completed_at__isnull=False
                ).exists(),
            }
        )


class CitizenPreferencesView(APIView):
    permission_classes = [IsAuthenticatedCitizen]

    def get_object(self, user):
        preference, _ = CitizenPreference.objects.get_or_create(user=user)
        return preference

    def get(self, request):
        preference = self.get_object(request.user)
        data = CitizenPreferenceSerializer(preference, context={"request": request}).data
        data["supported_languages"] = list(SUPPORTED_LANGUAGES)
        return Response(data)

    @citizen_preferences_patch_schema
    def patch(self, request):
        preference = self.get_object(request.user)
        serializer = CitizenPreferenceSerializer(
            preference, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        data = serializer.data
        data["supported_languages"] = list(SUPPORTED_LANGUAGES)
        return Response(data)


class CitizenOnboardingView(APIView):
    permission_classes = [IsAuthenticatedCitizen]

    def get_object(self, user):
        preference, _ = CitizenPreference.objects.get_or_create(user=user)
        return preference

    def get(self, request):
        preference = self.get_object(request.user)
        return Response({
            "step": preference.onboarding_step,
            "completed": preference.onboarding_completed_at is not None,
            "completed_at": preference.onboarding_completed_at,
            "profile_completion": _profile_completion(request.user),
            "quick_start": {
                "profile": "/api/account/profile/",
                "services": "/api/city/services/",
                "create_request": "/api/citizen/requests/",
            },
        })

    @citizen_onboarding_patch_schema
    def patch(self, request):
        preference = self.get_object(request.user)
        step = request.data.get("step")
        completed = request.data.get("completed")
        if step is not None:
            step = str(step).strip().lower()
            if step not in ONBOARDING_STEPS:
                return Response(
                    {"detail": "Étape d'onboarding invalide.", "allowed": list(ONBOARDING_STEPS)},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            preference.onboarding_step = step
        if completed is not None:
            if not isinstance(completed, bool):
                return Response(
                    {"detail": "Le champ completed doit être booléen."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            preference.onboarding_completed_at = timezone.now() if completed else None
            if completed:
                preference.onboarding_step = "done"
        preference.save()
        return self.get(request)


@method_decorator(name="get", decorator=report_list_schema)
@method_decorator(name="post", decorator=citizen_request_post_schema)
class CitizenRequestListCreateView(ReportMutationMixin, generics.ListCreateAPIView):
    pagination_class = ReportPagination
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = CitizenRequestSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return CitizenRequest.objects.none()
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return CitizenRequest.objects.none()
        queryset = CitizenRequest.objects.filter(citizen=user).select_related(
            "service", "assigned_to"
        )
        return filter_requests(queryset, self.request.query_params, citizen=True)

    def perform_create(self, serializer):
        instance = serializer.save()
        _register_service_usage(instance.service_id)
        _create_request_event(
            instance,
            actor=self.request.user,
            event_type=CitizenRequestEvent.EventType.CREATED,
            title="Demande enregistrée",
            message="Votre demande a été transmise aux services municipaux.",
        )
        CitizenNotification.objects.create(
            user=self.request.user,
            kind=CitizenNotification.Kind.REQUEST,
            title=f"Demande {instance.reference} enregistrée",
            message="Votre demande a bien été transmise aux services municipaux.",
            related_request=instance,
        )

    def create(self, request, *args, **kwargs):
        with attachment_transaction():
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            response_data = dict(serializer.data)
            response_data["confirmation"] = _request_confirmation(serializer.instance)
            return Response(response_data, status=status.HTTP_201_CREATED)

class CitizenRequestHistoryView(CitizenRequestListCreateView):
    http_method_names = ["get", "head", "options"]


@method_decorator(name="get", decorator=report_list_schema)
@method_decorator(name="post", decorator=citizen_report_post_schema)
class CitizenIssueReportCreateView(ReportMutationMixin, generics.ListCreateAPIView):
    pagination_class = ReportPagination

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return CitizenRequest.objects.none()
        queryset = CitizenRequest.objects.filter(citizen=self.request.user, request_type="report").select_related("citizen", "service", "assigned_to")
        return filter_requests(queryset, self.request.query_params, citizen=True)

    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = CitizenIssueReportSerializer

    def perform_create(self, serializer):
        instance = serializer.save()
        _register_service_usage(instance.service_id)
        _create_request_event(
            instance,
            actor=self.request.user,
            event_type=CitizenRequestEvent.EventType.CREATED,
            title="Signalement enregistré",
            message=("Votre signalement a été transmis au service compétent." if instance.service_id else "Votre signalement est enregistré et attend son orientation."),
        )
        CitizenNotification.objects.create(
            user=self.request.user,
            kind=CitizenNotification.Kind.REQUEST,
            title=f"Signalement {instance.reference} enregistré",
            message="Votre signalement a bien été pris en compte.",
            related_request=instance,
        )

    def create(self, request, *args, **kwargs):
        with attachment_transaction():
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            response_data = dict(serializer.data)
            response_data["confirmation"] = _request_confirmation(serializer.instance)
            return Response(response_data, status=status.HTTP_201_CREATED)

class CitizenRequestDetailView(ReportMutationMixin, generics.RetrieveAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = CitizenRequestDetailSerializer
    lookup_field = "reference"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return CitizenRequest.objects.none()
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return CitizenRequest.objects.none()
        return CitizenRequest.objects.filter(citizen=user).select_related(
            "service", "assigned_to"
        )


class CitizenRequestTimelineView(ReportMutationMixin, generics.ListAPIView):
    pagination_class = ReportPagination
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = CitizenRequestEventSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return CitizenRequestEvent.objects.none()
        return CitizenRequestEvent.objects.filter(
            request__reference=self.kwargs["reference"],
            request__citizen=self.request.user,
            is_public=True,
        ).select_related("actor", "request")


class CitizenContactMessageListView(generics.ListAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = CitizenContactMessageSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ContactMessage.objects.none()
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return ContactMessage.objects.none()
        return ContactMessage.objects.filter(user=user).select_related("service")


class CitizenContactMessageDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = CitizenContactMessageSerializer
    lookup_field = "reference"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ContactMessage.objects.none()
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return ContactMessage.objects.none()
        return ContactMessage.objects.filter(user=user).select_related("service")


class CitizenNotificationListView(generics.ListAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = CitizenNotificationSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return CitizenNotification.objects.none()
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return CitizenNotification.objects.none()
        queryset = CitizenNotification.objects.filter(
            user=user, visible_from__lte=timezone.now()
        ).filter(visible_notifications()).select_related(
            "sender", "related_request", "related_contact", "related_appointment", "related_news"
        ).order_by("-visible_from", "-created_at")
        unread = self.request.query_params.get("unread", "").strip().lower()
        if unread in {"1", "true", "yes"}:
            queryset = queryset.filter(is_read=False)
        return queryset


@method_decorator(name="patch", decorator=citizen_notification_patch_schema)
class CitizenNotificationDetailView(generics.RetrieveUpdateAPIView):
    http_method_names = ["get", "patch", "head", "options"]
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = CitizenNotificationSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return CitizenNotification.objects.none()
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return CitizenNotification.objects.none()
        return CitizenNotification.objects.filter(
            user=user, visible_from__lte=timezone.now()
        ).filter(visible_notifications()).select_related(
            "sender", "related_request", "related_contact", "related_appointment", "related_news"
        ).order_by("-visible_from", "-created_at")

    def put(self, request, *args, **kwargs):
        return Response(
            {"detail": "Utilisez PATCH pour modifier l'état de lecture."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


class CitizenNotificationReadAllView(APIView):
    permission_classes = [IsAuthenticatedCitizen]

    @citizen_notification_read_all_schema
    def post(self, request):
        now = timezone.now()
        updated = CitizenNotification.objects.filter(
            user=request.user, is_read=False, visible_from__lte=now
        ).filter(visible_notifications()).update(is_read=True, read_at=now)
        if updated:
            publish_after_commit(
                groups=[user_group(request.user.pk)],
                event="notifications.read_all",
                payload={"updated": updated},
            )
        return Response({"updated": updated})


class CitizenAppointmentAgentListView(generics.ListAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = AppointmentAgentSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return User.objects.none()
        return User.objects.filter(
            role=User.Role.AGENT,
            is_active=True,
            email_verified=True,
        ).order_by("first_name", "last_name", "email")


class CitizenAppointmentAvailabilityView(APIView):
    permission_classes = [IsAuthenticatedCitizen]

    def get(self, request):
        agent_id = request.query_params.get("agent")
        raw_date = (request.query_params.get("date") or "").strip()
        if not agent_id:
            return Response(
                {"agent": "Le paramètre agent est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            target_date = date.fromisoformat(raw_date)
        except ValueError:
            return Response(
                {"date": "Utilisez une date ISO au format YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            agent = User.objects.get(
                pk=agent_id,
                role=User.Role.AGENT,
                is_active=True,
            )
        except (User.DoesNotExist, ValueError):
            return Response(
                {"agent": "Agent introuvable ou indisponible."},
                status=status.HTTP_404_NOT_FOUND,
            )

        tz = timezone.get_current_timezone()
        day_start = timezone.make_aware(datetime.combine(target_date, time.min), tz)
        day_end = timezone.make_aware(datetime.combine(target_date, time.max), tz)
        slots = CitizenAppointment.objects.filter(
            agent=agent,
            status__in=ACTIVE_APPOINTMENT_STATUSES,
            starts_at__lt=day_end,
            ends_at__gt=day_start,
        ).order_by("starts_at")
        # Do not expose another citizen's appointment reference here.
        # The public availability endpoint only needs occupied intervals.
        unavailable = [
            {
                "starts_at": item.starts_at,
                "ends_at": item.ends_at,
            }
            for item in slots
        ]
        return Response(
            {
                "agent": AppointmentAgentSerializer(agent).data,
                "date": target_date.isoformat(),
                "timezone": timezone.get_current_timezone_name(),
                "unavailable": unavailable,
                "unavailable_count": len(unavailable),
                "selection": {
                    "starts_at_required": True,
                    "ends_at_required": True,
                    "interval_rule": "Le créneau choisi ne doit chevaucher aucun intervalle indisponible.",
                    "date_time_format": "ISO-8601",
                },
            }
        )


@method_decorator(name="post", decorator=citizen_appointment_post_schema)
class CitizenAppointmentListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = CitizenAppointmentSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return CitizenAppointment.objects.none()
        return CitizenAppointment.objects.filter(citizen=self.request.user).select_related(
            "citizen", "agent", "service"
        )

    def perform_create(self, serializer):
        with transaction.atomic():
            appointment = serializer.save()
            _sync_appointment_reminder(appointment)


@method_decorator(name="patch", decorator=citizen_appointment_patch_schema)
class CitizenAppointmentDetailView(generics.RetrieveUpdateAPIView):
    http_method_names = ["get", "patch", "head", "options"]
    permission_classes = [IsAuthenticatedCitizen]
    lookup_field = "reference"

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return CitizenAppointmentUpdateSerializer
        return CitizenAppointmentSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return CitizenAppointment.objects.none()
        return CitizenAppointment.objects.filter(citizen=self.request.user).select_related(
            "citizen", "agent", "service"
        )

    def patch(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            appointment = serializer.save()
            _sync_appointment_reminder(appointment)
        return Response(
            CitizenAppointmentSerializer(
                appointment,
                context={"request": request},
            ).data
        )


# ---------------------------------------------------------------------------
# Agent + Admin shared operational endpoints
# ---------------------------------------------------------------------------


class _NotificationCreateBaseView(APIView):
    def post(self, request):
        serializer = NotificationCreateSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            created, batch_code = _dispatch_manual_notification(
                sender=request.user,
                validated_data=serializer.validated_data,
            )
            record_staff_audit(
                actor=request.user,
                action="notification.send",
                resource_type="notification_batch",
                resource_id=batch_code,
                resource_reference=batch_code,
                subject_user=serializer.validated_data.get("recipient"),
                summary="Notification municipale envoyée",
                changes={
                    "audience": serializer.validated_data["audience"],
                    "created": created,
                    "is_important": serializer.validated_data.get("is_important", False),
                },
                request=request,
            )
        return Response(
            {
                "created": created,
                "audience": serializer.validated_data["audience"],
                "notification_code": batch_code,
                "visible_from": serializer.validated_data["visible_from"],
                "is_important": serializer.validated_data.get("is_important", False),
                "email_delivery": (
                    "scheduled_or_sent"
                    if serializer.validated_data.get("is_important", False)
                    else "not_requested"
                ),
            },
            status=status.HTTP_201_CREATED,
        )


class AgentNotificationCreateView(_NotificationCreateBaseView):
    permission_classes = [IsAuthenticatedAgent]

    @agent_notification_post_schema
    def post(self, request):
        return super().post(request)


class AdminNotificationCreateView(_NotificationCreateBaseView):
    permission_classes = [IsAuthenticatedAdmin]

    @admin_notification_post_schema
    def post(self, request):
        return super().post(request)


@method_decorator(name="get", decorator=agent_appointment_list_schema)
class AgentAppointmentListView(generics.ListAPIView):
    permission_classes = [AGENT_OR_ADMIN]
    serializer_class = AgentAppointmentSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return CitizenAppointment.objects.none()
        queryset = CitizenAppointment.objects.select_related("citizen", "agent", "service")
        if getattr(self.request.user, "role", None) == User.Role.AGENT:
            queryset = queryset.filter(agent=self.request.user)
        appointment_status = self.request.query_params.get("status")
        citizen = self.request.query_params.get("citizen")
        agent = self.request.query_params.get("agent")
        upcoming = (self.request.query_params.get("upcoming") or "").strip().lower()
        search = (self.request.query_params.get("search") or "").strip()
        date_from = (self.request.query_params.get("date_from") or "").strip()
        date_to = (self.request.query_params.get("date_to") or "").strip()
        if appointment_status:
            queryset = queryset.filter(status=appointment_status)
        if citizen:
            queryset = queryset.filter(citizen_id=citizen)
        if agent and getattr(self.request.user, "role", None) == User.Role.ADMIN:
            queryset = queryset.filter(agent_id=agent)
        if upcoming in {"1", "true", "yes"}:
            queryset = queryset.filter(
                status__in=ACTIVE_APPOINTMENT_STATUSES,
                ends_at__gte=timezone.now(),
            )
        start_day = None
        end_day = None
        if date_from:
            try:
                start_day = date.fromisoformat(date_from)
            except ValueError as exc:
                raise ValidationError({"date_from": "Utilisez YYYY-MM-DD."}) from exc
        if date_to:
            try:
                end_day = date.fromisoformat(date_to)
            except ValueError as exc:
                raise ValidationError({"date_to": "Utilisez YYYY-MM-DD."}) from exc
        if start_day and end_day and start_day > end_day:
            raise ValidationError({"date_to": "date_to doit être postérieure ou égale à date_from."})
        queryset = filter_local_date_range(queryset, "starts_at", start_day, end_day)
        if search:
            queryset = queryset.filter(
                Q(reference__icontains=search)
                | Q(reason__icontains=search)
                | Q(citizen__email__icontains=search)
                | Q(citizen__first_name__icontains=search)
                | Q(citizen__last_name__icontains=search)
                | Q(service__name__icontains=search)
            )
        return queryset


@method_decorator(name="patch", decorator=agent_appointment_patch_schema)
class AgentAppointmentDetailView(generics.RetrieveUpdateAPIView):
    http_method_names = ["get", "patch", "head", "options"]
    permission_classes = [AGENT_OR_ADMIN]
    serializer_class = AgentAppointmentSerializer
    lookup_field = "reference"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return CitizenAppointment.objects.none()
        queryset = CitizenAppointment.objects.select_related("citizen", "agent", "service")
        if getattr(self.request.user, "role", None) == User.Role.AGENT:
            queryset = queryset.filter(agent=self.request.user)
        return queryset

    def perform_update(self, serializer):
        appointment = serializer.instance
        previous = {
            "status": appointment.status,
            "starts_at": appointment.starts_at,
            "ends_at": appointment.ends_at,
            "location": appointment.location,
            "preparation_instructions": appointment.preparation_instructions,
        }
        with transaction.atomic():
            appointment = serializer.save()
            current = {
                "status": appointment.status,
                "starts_at": appointment.starts_at,
                "ends_at": appointment.ends_at,
                "location": appointment.location,
                "preparation_instructions": appointment.preparation_instructions,
            }
            _sync_appointment_reminder(appointment)
            if previous != current:
                _notify_appointment_update(appointment, sender=self.request.user)
                changed_fields = [name for name in previous if previous[name] != current[name]]
                safe_changes = {"fields": changed_fields}
                if previous["status"] != current["status"]:
                    safe_changes["status"] = {"from": previous["status"], "to": current["status"]}
                if previous["starts_at"] != current["starts_at"] or previous["ends_at"] != current["ends_at"]:
                    safe_changes["slot"] = {
                        "from": {"starts_at": previous["starts_at"], "ends_at": previous["ends_at"]},
                        "to": {"starts_at": current["starts_at"], "ends_at": current["ends_at"]},
                    }
                record_staff_audit(
                    actor=self.request.user,
                    action="appointment.update",
                    resource_type="appointment",
                    resource_id=appointment.pk,
                    resource_reference=appointment.reference,
                    subject_user=appointment.citizen,
                    summary="Rendez-vous citoyen mis à jour",
                    changes=safe_changes,
                    request=self.request,
                )


class AgentDashboardView(APIView):
    permission_classes = [AGENT_OR_ADMIN]

    def get(self, request):
        requests = CitizenRequest.objects.select_related("assigned_to", "service")
        appointments = CitizenAppointment.objects.select_related("citizen", "agent", "service")
        contacts = ContactMessage.objects.select_related("assigned_to", "service")
        is_agent = getattr(request.user, "role", None) == User.Role.AGENT
        if is_agent:
            appointments = appointments.filter(agent=request.user)
        now = timezone.now()
        day_ago = now - timedelta(hours=24)
        week_ago = now - timedelta(days=7)
        week_ahead = now + timedelta(days=7)
        today = timezone.localdate(now)
        appointments_today = filter_local_date_range(appointments, "starts_at", today, today)

        open_requests = requests.exclude(status__in=CLOSED)
        my_requests = open_requests.filter(assigned_to=request.user)
        unassigned_requests = open_requests.filter(assigned_to__isnull=True)
        audit_queryset = StaffAuditEvent.objects.select_related("actor", "subject_user")
        if is_agent:
            audit_queryset = audit_queryset.filter(visibility=StaffAuditEvent.Visibility.STAFF)

        try:
            webcup = get_webcup_requests(force=False)
            webcup_session = webcup.get("session", {})
            webcup_meta = webcup.get("meta", {})
        except WebCupUpstreamError:
            webcup_session = {}
            webcup_meta = {"upstream_available": False}

        return Response(
            {
                "generated_at": now,
                "workspace": {
                    "kind": "agent",
                    "role": request.user.role,
                    "display_name": request.user.get_full_name().strip() or request.user.email,
                    "capabilities": {
                        "requests": ["read", "assign", "update", "timeline"],
                        "citizens": ["read", "update_profile", "activate", "deactivate"],
                        "appointments": ["read", "confirm", "decline", "reschedule", "complete"],
                        "audit": ["read"],
                        "full_administration": request.user.role == User.Role.ADMIN,
                    },
                },
                "requests": {
                    "total": requests.count(),
                    "open": open_requests.count(),
                    "pending": requests.filter(status=CitizenRequest.Status.PENDING).count(),
                    "submitted": requests.filter(status=CitizenRequest.Status.SUBMITTED).count(),
                    "in_progress": requests.filter(status=CitizenRequest.Status.IN_PROGRESS).count(),
                    "action_required": requests.filter(status=CitizenRequest.Status.ACTION_REQUIRED).count(),
                    "completed": requests.filter(status=CitizenRequest.Status.COMPLETED).count(),
                    "awaiting_handling": requests.filter(
                        status__in=AWAITING_HANDLING_STATUSES, acknowledged_at__isnull=True
                    ).count(),
                    "needs_agent_action": requests.filter(status__in=AGENT_ACTION_STATUSES).count(),
                    "waiting_citizen": requests.filter(status=CitizenRequest.Status.ACTION_REQUIRED).count(),
                    "unassigned_open": unassigned_requests.count(),
                    "urgent_open": open_requests.filter(priority=CitizenRequest.Priority.URGENT).count(),
                    "high_priority_open": open_requests.filter(priority=CitizenRequest.Priority.HIGH).count(),
                    "created_last_24h": requests.filter(created_at__gte=day_ago).count(),
                    "updated_last_24h": requests.filter(updated_at__gte=day_ago).count(),
                },
                "my_work": {
                    "assigned_open_requests": my_requests.count(),
                    "assigned_needs_action": my_requests.filter(status__in=AGENT_ACTION_STATUSES).count(),
                    "unassigned_open_requests": unassigned_requests.count(),
                    "contacts_assigned_to_me": contacts.exclude(status=ContactMessage.Status.CLOSED).filter(assigned_to=request.user).count(),
                    "appointments_today": appointments_today.count(),
                    "appointments_next_7_days": appointments.filter(
                        status__in=ACTIVE_APPOINTMENT_STATUSES,
                        starts_at__gte=now,
                        starts_at__lte=week_ahead,
                    ).count(),
                },
                # Kept as an integer for backward compatibility with the existing frontend.
                "citizens": User.objects.filter(role=User.Role.CITIZEN).count(),
                "citizen_accounts": {
                    "total": User.objects.filter(role=User.Role.CITIZEN).count(),
                    "active": User.objects.filter(role=User.Role.CITIZEN, is_active=True).count(),
                    "inactive": User.objects.filter(role=User.Role.CITIZEN, is_active=False).count(),
                    "new_last_7_days": User.objects.filter(role=User.Role.CITIZEN, date_joined__gte=week_ago).count(),
                },
                "contacts_unread": contacts.filter(status=ContactMessage.Status.RECEIVED).count(),
                "contacts": {
                    "total": contacts.count(),
                    "received": contacts.filter(status=ContactMessage.Status.RECEIVED).count(),
                    "read": contacts.filter(status=ContactMessage.Status.READ).count(),
                    "closed": contacts.filter(status=ContactMessage.Status.CLOSED).count(),
                },
                "appointments": {
                    "total": appointments.count(),
                    "upcoming": appointments.filter(
                        status__in=ACTIVE_APPOINTMENT_STATUSES,
                        ends_at__gte=now,
                    ).count(),
                    "requested": appointments.filter(status=CitizenAppointment.Status.REQUESTED).count(),
                    "confirmed": appointments.filter(status=CitizenAppointment.Status.CONFIRMED).count(),
                    "today": appointments_today.count(),
                    "next_7_days": appointments.filter(
                        status__in=ACTIVE_APPOINTMENT_STATUSES,
                        starts_at__gte=now,
                        starts_at__lte=week_ahead,
                    ).count(),
                },
                "recent_activity": StaffAuditEventSerializer(audit_queryset[:10], many=True).data,
                "webcup": {"session": webcup_session, "meta": webcup_meta},
            }
        )


class AgentAuditListView(generics.ListAPIView):
    permission_classes = [AGENT_OR_ADMIN]
    serializer_class = StaffAuditEventSerializer
    pagination_class = ReportPagination

    @agent_audit_list_schema
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return StaffAuditEvent.objects.none()
        queryset = StaffAuditEvent.objects.select_related("actor", "subject_user")
        if getattr(self.request.user, "role", None) == User.Role.AGENT:
            queryset = queryset.filter(visibility=StaffAuditEvent.Visibility.STAFF)

        actor = self.request.query_params.get("actor")
        action = (self.request.query_params.get("action") or "").strip()
        resource_type = (self.request.query_params.get("resource_type") or "").strip()
        resource_id = (self.request.query_params.get("resource_id") or "").strip()
        search = (self.request.query_params.get("search") or "").strip()
        date_from = (self.request.query_params.get("date_from") or "").strip()
        date_to = (self.request.query_params.get("date_to") or "").strip()
        mine = (self.request.query_params.get("mine") or "").strip().lower()

        if actor:
            try:
                actor_id = int(actor)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"actor": "Un identifiant numérique est requis."}) from exc
            queryset = queryset.filter(actor_id=actor_id)
        if action:
            queryset = queryset.filter(action=action)
        if resource_type:
            queryset = queryset.filter(resource_type=resource_type)
        if resource_id:
            queryset = queryset.filter(resource_id=resource_id)
        if mine in {"1", "true", "yes"}:
            queryset = queryset.filter(actor=self.request.user)
        if search:
            queryset = queryset.filter(
                Q(summary__icontains=search)
                | Q(resource_reference__icontains=search)
                | Q(actor__email__icontains=search)
                | Q(actor__first_name__icontains=search)
                | Q(actor__last_name__icontains=search)
            )
        start_day = None
        end_day = None
        if date_from:
            try:
                start_day = date.fromisoformat(date_from)
            except ValueError as exc:
                raise ValidationError({"date_from": "Utilisez YYYY-MM-DD."}) from exc
        if date_to:
            try:
                end_day = date.fromisoformat(date_to)
            except ValueError as exc:
                raise ValidationError({"date_to": "Utilisez YYYY-MM-DD."}) from exc
        if start_day and end_day and start_day > end_day:
            raise ValidationError({"date_to": "date_to doit être postérieure ou égale à date_from."})
        return filter_local_date_range(queryset, "created_at", start_day, end_day)


class AgentAuditDetailView(generics.RetrieveAPIView):
    permission_classes = [AGENT_OR_ADMIN]
    serializer_class = StaffAuditEventSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return StaffAuditEvent.objects.none()
        queryset = StaffAuditEvent.objects.select_related("actor", "subject_user")
        if getattr(self.request.user, "role", None) == User.Role.AGENT:
            queryset = queryset.filter(visibility=StaffAuditEvent.Visibility.STAFF)
        return queryset


class AdminAuditListView(AgentAuditListView):
    permission_classes = [IsAuthenticatedAdmin]

    @admin_audit_list_schema
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class AdminAuditDetailView(AgentAuditDetailView):
    permission_classes = [IsAuthenticatedAdmin]


class AgentRequestListView(generics.ListAPIView):
    pagination_class = ReportPagination
    permission_classes = [AGENT_OR_ADMIN]
    serializer_class = AgentCitizenRequestSerializer

    @agent_request_list_schema
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return CitizenRequest.objects.none()
        queryset = CitizenRequest.objects.select_related("citizen", "service", "assigned_to")
        request_status = self.request.query_params.get("status")
        service = self.request.query_params.get("service")
        assigned_to = self.request.query_params.get("assigned_to")
        priority = self.request.query_params.get("priority")
        request_type = self.request.query_params.get("type")
        incident_category = self.request.query_params.get("incident_category")
        search = self.request.query_params.get("search")
        duplicate = (self.request.query_params.get("duplicate") or "").strip().lower()
        if request_status:
            queryset = queryset.filter(status=request_status)
        if service:
            queryset = queryset.filter(service_id=int(service)) if str(service).isdigit() else queryset.filter(service__slug=service)
        if assigned_to:
            try:
                assigned_to = int(assigned_to)
            except (ValueError, TypeError):
                raise ValidationError({'assigned_to': 'Un identifiant numérique est requis.'})
            queryset = queryset.filter(assigned_to_id=assigned_to)
        if priority:
            queryset = queryset.filter(priority=priority)
        if request_type:
            queryset = queryset.filter(request_type=request_type)
        if incident_category:
            queryset = queryset.filter(incident_category__iexact=incident_category)
        if search:
            queryset = queryset.filter(
                Q(reference__icontains=search)
                | Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(citizen__email__icontains=search)
                | Q(citizen__first_name__icontains=search)
                | Q(citizen__last_name__icontains=search)
                | Q(service__name__icontains=search)
            )
        if duplicate in {"1", "true", "yes"}:
            queryset = queryset.filter(duplicate_of__isnull=False)
        elif duplicate in {"0", "false", "no"}:
            queryset = queryset.filter(duplicate_of__isnull=True)
        elif duplicate:
            raise ValidationError({"duplicate": "Utilisez true ou false."})
        queryset = _filter_agent_workflow(queryset, self.request.query_params)
        return filter_requests(queryset, self.request.query_params)


class AgentRequestSummaryView(APIView):
    permission_classes = [AGENT_OR_ADMIN]

    def get(self, request):
        queryset = CitizenRequest.objects.all()
        open_queryset = queryset.exclude(status__in=CLOSED)
        return Response({
            "total": queryset.count(),
            "open": open_queryset.count(),
            "awaiting_handling": queryset.filter(
                status__in=AWAITING_HANDLING_STATUSES, acknowledged_at__isnull=True
            ).count(),
            "needs_agent_action": queryset.filter(status__in=AGENT_ACTION_STATUSES).count(),
            "waiting_citizen": queryset.filter(status=CitizenRequest.Status.ACTION_REQUIRED).count(),
            "unassigned_open": open_queryset.filter(assigned_to__isnull=True).count(),
            "pending": queryset.filter(status=CitizenRequest.Status.PENDING).count(),
            "submitted": queryset.filter(status=CitizenRequest.Status.SUBMITTED).count(),
            "in_progress": queryset.filter(status=CitizenRequest.Status.IN_PROGRESS).count(),
            "action_required": queryset.filter(status=CitizenRequest.Status.ACTION_REQUIRED).count(),
            "completed": queryset.filter(status=CitizenRequest.Status.COMPLETED).count(),
            "cancelled": queryset.filter(status=CitizenRequest.Status.CANCELLED).count(),
            "rejected": queryset.filter(status=CitizenRequest.Status.REJECTED).count(),
            "needs_triage": open_queryset.filter(request_type="report", service__isnull=True).count(),
            "reports": queryset.filter(request_type=CitizenRequest.RequestType.REPORT).count(),
            "duplicates": queryset.filter(duplicate_of__isnull=False).count(),
        })


class AgentRequestSimilarView(APIView):
    permission_classes = [AGENT_OR_ADMIN]

    @agent_request_similar_schema
    def get(self, request, reference):
        source = generics.get_object_or_404(
            CitizenRequest.objects.select_related("service", "duplicate_of"),
            reference=reference,
        )
        if source.request_type != CitizenRequest.RequestType.REPORT:
            raise ValidationError({
                "detail": "La détection de similarité F75 concerne uniquement les signalements."
            })
        try:
            limit = int(request.query_params.get("limit", 8))
        except (TypeError, ValueError) as exc:
            raise ValidationError({"limit": "Un entier entre 1 et 20 est requis."}) from exc
        if not 1 <= limit <= 20:
            raise ValidationError({"limit": "Un entier entre 1 et 20 est requis."})
        try:
            threshold = float(request.query_params.get("min_score", 0.42))
        except (TypeError, ValueError) as exc:
            raise ValidationError({"min_score": "Une valeur entre 0.20 et 0.95 est requise."}) from exc
        if not 0.20 <= threshold <= 0.95:
            raise ValidationError({"min_score": "Une valeur entre 0.20 et 0.95 est requise."})

        results = find_similar_requests(source, limit=limit, min_score=threshold)
        payload = {
            "request_id": source.pk,
            "request_reference": source.reference,
            "threshold": threshold,
            "count": len(results),
            "results": results,
        }
        return Response(SimilarCitizenRequestResponseSerializer(payload).data)


class AdminRequestSimilarView(AgentRequestSimilarView):
    permission_classes = [IsAuthenticatedAdmin]

    @admin_request_similar_schema
    def get(self, request, reference):
        return super().get(request, reference)


@method_decorator(name="patch", decorator=agent_request_patch_schema)
class AgentRequestDetailView(ReportMutationMixin, generics.RetrieveUpdateAPIView):
    http_method_names = ["get", "patch", "head", "options"]
    permission_classes = [AGENT_OR_ADMIN]
    serializer_class = AgentCitizenRequestDetailSerializer
    lookup_field = "reference"
    queryset = CitizenRequest.objects.select_related("citizen", "service", "assigned_to")

    def put(self, request, *args, **kwargs):
        return Response(
            {"detail": "Utilisez PATCH pour modifier une demande."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        with attachment_transaction():
            instance = generics.get_object_or_404(self.get_queryset().select_for_update(), reference=self.kwargs['reference'])
            self.check_object_permissions(request, instance)
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            data = serializer.data
        return Response(data)

    @transaction.atomic
    def perform_update(self, serializer):
        previous_status = serializer.instance.status
        previous_priority = serializer.instance.priority
        previous_assignee = serializer.instance.assigned_to_id
        previous_service = serializer.instance.service_id
        previous_summary = serializer.instance.resolution_summary
        previous_duplicate = serializer.instance.duplicate_of_id
        instance = serializer.save()
        _notify_request_status(
            instance,
            previous_status=previous_status,
            sender=self.request.user,
        )
        if previous_status != instance.status:
            _create_request_event(
                instance,
                actor=self.request.user,
                event_type=CitizenRequestEvent.EventType.STATUS,
                title=instance.get_status_display(),
                message=(instance.resolution_summary or f"Le statut de la demande est passé à « {instance.get_status_display()} »."),
                is_public=True,
            )
        if previous_priority != instance.priority:
            _create_request_event(
                instance, actor=self.request.user, title="Priorité mise à jour",
                message=f"Priorité : {instance.get_priority_display()}.", is_public=False
            )
        if previous_assignee != instance.assigned_to_id:
            _create_request_event(
                instance, actor=self.request.user, title="Responsable mis à jour",
                message="La demande a été réassignée.", is_public=False
            )

        if previous_service != instance.service_id:
            report_event(instance, self.request.user, 'Orientation municipale mise à jour',
                         f'Service : {instance.service.name if instance.service else "À orienter"}.')
        if previous_duplicate != instance.duplicate_of_id:
            report_event(instance, self.request.user, 'Lien de doublon mis à jour', public=False)
        if previous_summary != instance.resolution_summary and previous_status == instance.status:
            report_event(instance, self.request.user, 'Précision du traitement', instance.resolution_summary)
            if instance.request_type == 'report':
                notify_report_citizen(instance, self.request.user, 'Une précision de traitement est disponible.')

        audit_changes = {}
        if previous_status != instance.status:
            audit_changes["status"] = {"from": previous_status, "to": instance.status}
        if previous_priority != instance.priority:
            audit_changes["priority"] = {"from": previous_priority, "to": instance.priority}
        if previous_assignee != instance.assigned_to_id:
            audit_changes["assigned_to"] = {"from": previous_assignee, "to": instance.assigned_to_id}
        if previous_service != instance.service_id:
            audit_changes["service"] = {"from": previous_service, "to": instance.service_id}
        if previous_duplicate != instance.duplicate_of_id:
            audit_changes["duplicate_of"] = {"from": previous_duplicate, "to": instance.duplicate_of_id}
        if previous_summary != instance.resolution_summary:
            audit_changes.setdefault("fields", []).append("resolution_summary")
        if audit_changes:
            record_staff_audit(
                actor=self.request.user,
                action="request.update",
                resource_type="request",
                resource_id=instance.pk,
                resource_reference=instance.reference,
                subject_user=instance.citizen,
                summary="Traitement d'une demande citoyenne mis à jour",
                changes=audit_changes,
                request=self.request,
            )


@method_decorator(name="post", decorator=agent_request_event_post_schema)
class AgentRequestTimelineView(ReportMutationMixin, generics.ListCreateAPIView):
    pagination_class = ReportPagination

    def create(self, request, *args, **kwargs):
        with attachment_transaction():
            item = generics.get_object_or_404(CitizenRequest.objects.select_for_update(), reference=self.kwargs["reference"])
            serializer = self.get_serializer(data=request.data, context={"request": request, "citizen_request": item})
            serializer.is_valid(raise_exception=True)
            instance = serializer.save()
            item.save(update_fields=["updated_at"])
            record_staff_audit(
                actor=request.user,
                action="request.timeline_add",
                resource_type="request",
                resource_id=item.pk,
                resource_reference=item.reference,
                subject_user=item.citizen,
                summary="Étape ajoutée à la chronologie d'une demande",
                changes={"event_type": instance.event_type, "is_public": instance.is_public},
                request=request,
            )
            data = CitizenRequestEventSerializer(instance, context={"request": request}).data
        return Response(data, status=201)

    permission_classes = [AGENT_OR_ADMIN]

    def get_serializer_class(self):
        return AgentRequestEventCreateSerializer if self.request.method == "POST" else CitizenRequestEventSerializer

    def get_citizen_request(self):
        return generics.get_object_or_404(CitizenRequest, reference=self.kwargs["reference"])

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return CitizenRequestEvent.objects.none()
        return CitizenRequestEvent.objects.filter(
            request__reference=self.kwargs["reference"]
        ).select_related("actor", "request")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if not getattr(self, "swagger_fake_view", False):
            context["citizen_request"] = self.get_citizen_request()
        return context



class AgentAssigneeListView(generics.ListAPIView):
    permission_classes = [AGENT_OR_ADMIN]
    serializer_class = AssigneeSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return User.objects.none()
        return User.objects.filter(
            Q(role=User.Role.AGENT) | Q(role=User.Role.ADMIN), is_active=True
        ).order_by("role", "first_name", "last_name", "email")


class AgentContactMessageListView(generics.ListAPIView):
    permission_classes = [AGENT_OR_ADMIN]
    serializer_class = ContactMessageSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ContactMessage.objects.none()
        queryset = ContactMessage.objects.select_related("user", "service", "assigned_to")
        message_status = self.request.query_params.get("status")
        service = self.request.query_params.get("service")
        assigned_to = self.request.query_params.get("assigned_to")
        search = self.request.query_params.get("search")
        if message_status:
            queryset = queryset.filter(status=message_status)
        if service:
            queryset = queryset.filter(service_id=int(service)) if str(service).isdigit() else queryset.filter(service__slug=service)
        if assigned_to:
            from rest_framework.exceptions import ValidationError
            try:
                assigned_to = int(assigned_to)
            except (ValueError, TypeError):
                raise ValidationError({'assigned_to': 'Un identifiant numérique est requis.'})
            queryset = queryset.filter(assigned_to_id=assigned_to)
        if search:
            queryset = queryset.filter(
                Q(reference__icontains=search)
                | Q(name__icontains=search)
                | Q(email__icontains=search)
                | Q(subject__icontains=search)
                | Q(message__icontains=search)
            )
        return queryset


@method_decorator(name="patch", decorator=agent_contact_patch_schema)
class AgentContactMessageDetailView(generics.RetrieveUpdateAPIView):
    http_method_names = ["get", "patch", "head", "options"]
    permission_classes = [AGENT_OR_ADMIN]
    serializer_class = ContactMessageSerializer
    lookup_field = "reference"
    queryset = ContactMessage.objects.select_related("user", "service", "assigned_to")

    def put(self, request, *args, **kwargs):
        return Response(
            {"detail": "Utilisez PATCH pour mettre à jour le statut ou le responsable."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        previous_status = serializer.instance.status
        previous_assignee = serializer.instance.assigned_to_id
        instance = serializer.save()
        changes = {}
        if previous_status != instance.status:
            changes["status"] = {"from": previous_status, "to": instance.status}
        if previous_assignee != instance.assigned_to_id:
            changes["assigned_to"] = {"from": previous_assignee, "to": instance.assigned_to_id}
        if changes:
            record_staff_audit(
                actor=self.request.user,
                action="contact.update",
                resource_type="contact_message",
                resource_id=instance.pk,
                resource_reference=instance.reference,
                subject_user=instance.user,
                summary="Message citoyen mis à jour",
                changes=changes,
                request=self.request,
            )


class WebCupRequestsView(APIView):
    permission_classes = [AGENT_OR_ADMIN]
    throttle_scope = "webcup"

    def get(self, request):
        force = request.query_params.get("force", "").strip().lower() in {"1", "true", "yes"}
        try:
            return Response(get_webcup_requests(force=force))
        except WebCupUpstreamError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


class WebCupSnapshotListView(generics.ListAPIView):
    permission_classes = [AGENT_OR_ADMIN]
    serializer_class = WebCupRequestSnapshotSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return WebCupRequestSnapshot.objects.none()
        queryset = WebCupRequestSnapshot.objects.all()
        visible = self.request.query_params.get("visible")
        wave = self.request.query_params.get("wave")
        search = self.request.query_params.get("search")
        if visible in {"1", "true", "yes"}:
            queryset = queryset.filter(is_visible=True)
        if visible in {"0", "false", "no"}:
            queryset = queryset.filter(is_visible=False)
        if wave not in (None, ""):
            queryset = queryset.filter(wave_number=wave)
        if search:
            queryset = queryset.filter(
                Q(request_code__icontains=search)
                | Q(requester_name__icontains=search)
                | Q(message_public__icontains=search)
            )
        return queryset


class WebCupStatusView(APIView):
    permission_classes = [AGENT_OR_ADMIN]

    def get(self, request):
        state = WebCupSyncState.objects.filter(key="requests").first()
        return Response(
            {
                "api_version": state.api_version if state else None,
                "session": state.session if state else {},
                "last_success_at": state.last_success_at if state else None,
                "last_error": state.last_error if state else "",
                "visible_requests_count": WebCupRequestSnapshot.objects.filter(is_visible=True).count(),
                "known_requests_count": WebCupRequestSnapshot.objects.count(),
            }
        )


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------


class AdminDashboardView(APIView):
    permission_classes = [IsAuthenticatedAdmin]

    def get(self, request):
        users = User.objects.all()
        citizen_requests = CitizenRequest.objects.all()
        appointments = CitizenAppointment.objects.all()
        now = timezone.now()
        state = WebCupSyncState.objects.filter(key="requests").first()
        return Response(
            {
                "users": {
                    "total": users.count(),
                    "active": users.filter(is_active=True).count(),
                    "citizens": users.filter(role=User.Role.CITIZEN).count(),
                    "agents": users.filter(role=User.Role.AGENT).count(),
                    "admins": users.filter(role=User.Role.ADMIN).count(),
                },
                "services": {
                    "total": MunicipalService.objects.count(),
                    "active": MunicipalService.objects.filter(is_active=True).count(),
                },
                "news": {
                    "total": NewsArticle.objects.count(),
                    "published": NewsArticle.objects.filter(active_news()).count(),
                    "scheduled": NewsArticle.objects.filter(is_published=True, published_at__gt=timezone.now()).count(),
                    "drafts": NewsArticle.objects.filter(is_published=False).count(),
                },
                "requests": {
                    "total": citizen_requests.count(),
                    "pending": citizen_requests.filter(status=CitizenRequest.Status.PENDING).count(),
                    "in_progress": citizen_requests.filter(status=CitizenRequest.Status.IN_PROGRESS).count(),
                    "action_required": citizen_requests.filter(status=CitizenRequest.Status.ACTION_REQUIRED).count(),
                    "completed": citizen_requests.filter(status=CitizenRequest.Status.COMPLETED).count(),
                    "awaiting_handling": citizen_requests.filter(
                        status__in=AWAITING_HANDLING_STATUSES, acknowledged_at__isnull=True
                    ).count(),
                    "needs_agent_action": citizen_requests.filter(status__in=AGENT_ACTION_STATUSES).count(),
                    "unassigned_open": citizen_requests.exclude(status__in=CLOSED).filter(assigned_to__isnull=True).count(),
                    "reports": citizen_requests.filter(
                        request_type=CitizenRequest.RequestType.REPORT
                    ).count(),
                },
                "contacts": {
                    "total": ContactMessage.objects.count(),
                    "unread": ContactMessage.objects.filter(status=ContactMessage.Status.RECEIVED).count(),
                },
                "appointments": {
                    "total": appointments.count(),
                    "upcoming": appointments.filter(
                        status__in=ACTIVE_APPOINTMENT_STATUSES,
                        ends_at__gte=now,
                    ).count(),
                    "requested": appointments.filter(
                        status=CitizenAppointment.Status.REQUESTED
                    ).count(),
                    "confirmed": appointments.filter(
                        status=CitizenAppointment.Status.CONFIRMED
                    ).count(),
                },
                "audit": {
                    "total": StaffAuditEvent.objects.count(),
                    "last_24h": StaffAuditEvent.objects.filter(created_at__gte=now - timedelta(hours=24)).count(),
                    "recent": StaffAuditEventSerializer(
                        StaffAuditEvent.objects.select_related("actor", "subject_user")[:10], many=True
                    ).data,
                },
                "webcup": {
                    "visible_requests": WebCupRequestSnapshot.objects.filter(is_visible=True).count(),
                    "session": state.session if state else {},
                    "last_success_at": state.last_success_at if state else None,
                    "last_error": state.last_error if state else "",
                },
            }
        )


@method_decorator(name="post", decorator=admin_user_post_schema)
class AdminUserListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedAdmin]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AdminUserCreateSerializer
        return AdminUserSerializer

    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save()
        record_staff_audit(
            actor=self.request.user,
            action="admin.user_create",
            resource_type="user",
            resource_id=instance.pk,
            resource_reference=instance.email,
            subject_user=instance,
            summary="Compte utilisateur créé dans l'administration",
            changes={"role": instance.role, "is_active": instance.is_active},
            request=self.request,
            visibility=StaffAuditEvent.Visibility.ADMIN,
        )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return User.objects.none()
        queryset = User.objects.annotate(
            request_count=Count("citizen_requests", distinct=True),
            contact_count=Count("contact_messages", distinct=True),
        )
        role = self.request.query_params.get("role")
        active = self.request.query_params.get("active")
        search = self.request.query_params.get("search")
        if role:
            queryset = queryset.filter(role=role)
        if active in {"1", "true", "yes"}:
            queryset = queryset.filter(is_active=True)
        if active in {"0", "false", "no"}:
            queryset = queryset.filter(is_active=False)
        if search:
            queryset = queryset.filter(
                Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )
        return queryset.order_by("-date_joined")


@method_decorator(name="patch", decorator=admin_user_patch_schema)
class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    http_method_names = ["get", "patch", "head", "options"]
    permission_classes = [IsAuthenticatedAdmin]
    queryset = User.objects.all()

    def get_serializer_class(self):
        if self.request.method in {"PATCH", "PUT"}:
            return AdminUserUpdateSerializer
        return AdminUserSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def put(self, request, *args, **kwargs):
        return Response(
            {"detail": "Utilisez PATCH pour modifier un utilisateur."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @transaction.atomic
    def patch(self, request, *args, **kwargs):
        instance = self.get_object()
        tracked_fields = ("first_name", "last_name", "phone_number", "role", "email_verified", "is_active", "locale")
        previous = {field: getattr(instance, field) for field in tracked_fields}
        super().patch(request, *args, **kwargs)
        instance.refresh_from_db()
        changes = {}
        for field in tracked_fields:
            current = getattr(instance, field)
            if previous[field] != current:
                if field in {"role", "email_verified", "is_active"}:
                    changes[field] = {"from": previous[field], "to": current}
                else:
                    changes.setdefault("fields", []).append(field)
        if changes:
            record_staff_audit(
                actor=request.user,
                action="admin.user_update",
                resource_type="user",
                resource_id=instance.pk,
                resource_reference=instance.email,
                subject_user=instance,
                summary="Compte utilisateur modifié dans l'administration",
                changes=changes,
                request=request,
                visibility=StaffAuditEvent.Visibility.ADMIN,
            )
        return Response(AdminUserSerializer(instance, context={"request": request}).data)


@method_decorator(name="post", decorator=admin_service_post_schema)
class AdminServiceListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminMunicipalServiceSerializer

    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save()
        record_staff_audit(
            actor=self.request.user, action="service.create", resource_type="service",
            resource_id=instance.pk, resource_reference=instance.slug,
            summary="Service municipal créé", changes={"is_active": instance.is_active},
            request=self.request,
        )

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return MunicipalService.objects.none()
        queryset = MunicipalService.objects.all()
        active = self.request.query_params.get("active")
        featured = self.request.query_params.get("featured")
        search = self.request.query_params.get("search")
        if active in {"1", "true", "yes"}:
            queryset = queryset.filter(is_active=True)
        if active in {"0", "false", "no"}:
            queryset = queryset.filter(is_active=False)
        if featured in {"1", "true", "yes"}:
            queryset = queryset.filter(is_featured=True)
        if featured in {"0", "false", "no"}:
            queryset = queryset.filter(is_featured=False)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(category__icontains=search)
            )
        return queryset


@method_decorator(name="patch", decorator=admin_service_patch_schema)
@method_decorator(name="delete", decorator=admin_service_delete_schema)
class AdminServiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    http_method_names = ["get", "patch", "delete", "head", "options"]
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminMunicipalServiceSerializer
    lookup_field = "slug"
    queryset = MunicipalService.objects.all()

    @transaction.atomic
    def perform_update(self, serializer):
        instance = serializer.instance
        tracked = (
            "name", "category", "short_description", "opening_hours", "phone",
            "email", "address", "is_featured", "priority_order", "is_active",
            "unavailability_reason", "alternative_action", "expected_restore_at",
            "sort_order",
        )
        previous = {field: getattr(instance, field) for field in tracked}
        instance = serializer.save()
        changed_fields = [field for field in tracked if previous[field] != getattr(instance, field)]
        if changed_fields:
            record_staff_audit(
                actor=self.request.user, action="service.update", resource_type="service",
                resource_id=instance.pk, resource_reference=instance.slug,
                summary="Service municipal modifié", changes={"fields": changed_fields},
                request=self.request,
            )

    @transaction.atomic
    def perform_destroy(self, instance):
        was_active = instance.is_active
        instance.set_availability(
            is_available=False,
            reason=instance.unavailability_reason or "Service temporairement indisponible.",
            alternative_action=(
                instance.alternative_action
                or "Réessayez ultérieurement ou contactez la mairie si votre demande est urgente."
            ),
            expected_restore_at=instance.expected_restore_at,
        )
        record_staff_audit(
            actor=self.request.user, action="service.deactivate", resource_type="service",
            resource_id=instance.pk, resource_reference=instance.slug,
            summary="Service municipal désactivé", changes={"is_active": {"from": was_active, "to": False}},
            request=self.request,
        )


class ServiceAvailabilityView(APIView):
    """Bascule opérationnelle F63/F64 pour un agent responsable ou un admin."""

    permission_classes = [AGENT_OR_ADMIN]

    @service_availability_patch_schema
    @transaction.atomic
    def patch(self, request, slug):
        try:
            service = MunicipalService.objects.select_for_update().get(slug=slug)
        except MunicipalService.DoesNotExist:
            return Response({"detail": "Service municipal introuvable."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ServiceAvailabilityUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        previous = {
            "is_available": service.is_active,
            "reason": service.unavailability_reason,
            "alternative_action": service.alternative_action,
            "expected_restore_at": service.expected_restore_at.isoformat() if service.expected_restore_at else None,
        }

        service.set_availability(
            is_available=data["is_available"],
            reason=data.get("reason", ""),
            alternative_action=data.get("alternative_action", ""),
            expected_restore_at=data.get("expected_restore_at"),
        )

        current = {
            "is_available": service.is_active,
            "reason": service.unavailability_reason,
            "alternative_action": service.alternative_action,
            "expected_restore_at": service.expected_restore_at.isoformat() if service.expected_restore_at else None,
        }
        if previous != current:
            record_staff_audit(
                actor=request.user,
                action=("service.restore" if service.is_active else "service.unavailable"),
                resource_type="service",
                resource_id=service.pk,
                resource_reference=service.slug,
                summary=(
                    "Service municipal remis en service"
                    if service.is_active
                    else "Service municipal marqué indisponible"
                ),
                changes={"availability": {"from": previous, "to": current}},
                request=request,
            )

        return Response(AdminMunicipalServiceSerializer(service, context={"request": request}).data)


class AdminContactMessageListView(AgentContactMessageListView):
    permission_classes = [IsAuthenticatedAdmin]


class AdminContactMessageDetailView(AgentContactMessageDetailView):
    permission_classes = [IsAuthenticatedAdmin]

    @admin_contact_patch_schema
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)


class AdminRequestListView(AgentRequestListView):
    permission_classes = [IsAuthenticatedAdmin]

    @admin_request_list_schema
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class AdminRequestSummaryView(AgentRequestSummaryView):
    permission_classes = [IsAuthenticatedAdmin]


class AdminRequestTimelineView(AgentRequestTimelineView):
    permission_classes = [IsAuthenticatedAdmin]

    @admin_request_event_post_schema
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class AdminRequestDetailView(AgentRequestDetailView):
    permission_classes = [IsAuthenticatedAdmin]

    @admin_request_patch_schema
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)


class AdminAppointmentListView(AgentAppointmentListView):
    permission_classes = [IsAuthenticatedAdmin]

    @admin_appointment_list_schema
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class AdminAppointmentDetailView(AgentAppointmentDetailView):
    permission_classes = [IsAuthenticatedAdmin]

    @admin_appointment_patch_schema
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)


class AdminSystemView(APIView):
    permission_classes = [IsAuthenticatedAdmin]

    def get(self, request):
        state = WebCupSyncState.objects.filter(key="requests").first()
        return Response(
            {
                "api": {"status": "ok"},
                "webcup": {
                    "configured": bool(settings.WEBCUP_API_KEY),
                    "last_success_at": state.last_success_at if state else None,
                    "last_error": state.last_error if state else "",
                    "session": state.session if state else {},
                },
                "security": {
                    "roles": [User.Role.CITIZEN, User.Role.AGENT, User.Role.ADMIN],
                    "jwt_refresh_cookie": "HttpOnly",
                    "sensitive_settings_exposed": False,
                },
            }
        )
