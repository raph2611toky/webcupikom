from django.conf import settings
from django.db import transaction
from django.db.models import Count, F, Q
from django.utils import timezone
from django.utils.decorators import method_decorator
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import User
from helpers.permissions import (
    IsAuthenticatedAdmin,
    IsAuthenticatedAgent,
    IsAuthenticatedCitizen,
)

from .models import (
    CitizenNotification,
    CitizenPreference,
    CitizenRequest,
    CitizenRequestEvent,
    ContactMessage,
    MunicipalService,
    NewsArticle,
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
    AgentCitizenDetailSerializer,
    AgentCitizenListSerializer,
    AgentCitizenRequestDetailSerializer,
    AgentCitizenRequestSerializer,
    AgentRequestEventCreateSerializer,
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
    NewsArticleSerializer,
    WebCupRequestSnapshotSerializer,
)
from .swagger import (
    admin_contact_patch_schema,
    admin_news_delete_schema,
    admin_news_patch_schema,
    admin_news_post_schema,
    admin_request_event_post_schema,
    admin_request_patch_schema,
    admin_service_delete_schema,
    admin_service_patch_schema,
    admin_service_post_schema,
    admin_user_patch_schema,
    admin_user_post_schema,
    agent_contact_patch_schema,
    agent_request_event_post_schema,
    agent_request_patch_schema,
    citizen_notification_patch_schema,
    citizen_notification_read_all_schema,
    citizen_onboarding_patch_schema,
    citizen_preferences_patch_schema,
    citizen_report_post_schema,
    citizen_request_post_schema,
    contact_create_schema,
)
from .services.webcup import WebCupUpstreamError, get_webcup_requests


AGENT_OR_ADMIN = IsAuthenticatedAgent | IsAuthenticatedAdmin


def _notify_request_status(citizen_request, previous_status=None):
    if previous_status == citizen_request.status:
        return
    label = citizen_request.get_status_display()
    CitizenNotification.objects.create(
        user=citizen_request.citizen,
        kind=CitizenNotification.Kind.REQUEST,
        title=f"Demande {citizen_request.reference}",
        message=f"Le statut de votre demande est maintenant : {label}.",
        related_request=citizen_request,
    )


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
    return {
        "message": "Votre demande a bien été enregistrée et transmise aux services municipaux.",
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
        queryset = MunicipalService.objects.filter(is_active=True)
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
    queryset = MunicipalService.objects.filter(is_active=True)


class NewsListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = NewsArticleSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return NewsArticle.objects.none()
        queryset = NewsArticle.objects.filter(is_published=True)
        category = self.request.query_params.get("category")
        search = self.request.query_params.get("search")
        if category:
            queryset = queryset.filter(category__iexact=category.strip())
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(excerpt__icontains=search)
                | Q(content__icontains=search)
            )
        return queryset


class NewsDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = NewsArticleSerializer
    lookup_field = "slug"
    queryset = NewsArticle.objects.filter(is_published=True)


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
                    user=request.user, is_read=False
                ).count(),
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


@method_decorator(name="post", decorator=citizen_request_post_schema)
class CitizenRequestListCreateView(generics.ListCreateAPIView):
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
        request_status = self.request.query_params.get("status")
        request_type = self.request.query_params.get("type")
        search = self.request.query_params.get("search")
        if request_status:
            queryset = queryset.filter(status=request_status)
        if request_type:
            queryset = queryset.filter(request_type=request_type)
        if search:
            queryset = queryset.filter(
                Q(reference__icontains=search)
                | Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(service__name__icontains=search)
            )
        return queryset

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
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        response_data = dict(serializer.data)
        response_data["confirmation"] = _request_confirmation(serializer.instance)
        return Response(response_data, status=status.HTTP_201_CREATED)


class CitizenRequestHistoryView(CitizenRequestListCreateView):
    http_method_names = ["get", "head", "options"]


@method_decorator(name="post", decorator=citizen_report_post_schema)
class CitizenIssueReportCreateView(generics.CreateAPIView):
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
            message="Votre signalement a été transmis aux services municipaux.",
        )
        CitizenNotification.objects.create(
            user=self.request.user,
            kind=CitizenNotification.Kind.REQUEST,
            title=f"Signalement {instance.reference} enregistré",
            message="Votre signalement a bien été pris en compte.",
            related_request=instance,
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        response_data = dict(serializer.data)
        response_data["confirmation"] = _request_confirmation(serializer.instance)
        return Response(response_data, status=status.HTTP_201_CREATED)


class CitizenRequestDetailView(generics.RetrieveAPIView):
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


class CitizenRequestTimelineView(generics.ListAPIView):
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
        queryset = CitizenNotification.objects.filter(user=user).select_related(
            "related_request", "related_contact"
        )
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
        return CitizenNotification.objects.filter(user=user).select_related(
            "related_request", "related_contact"
        )

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
            user=request.user, is_read=False
        ).update(is_read=True, read_at=now)
        return Response({"updated": updated})


# ---------------------------------------------------------------------------
# Agent + Admin shared operational endpoints
# ---------------------------------------------------------------------------


class AgentDashboardView(APIView):
    permission_classes = [AGENT_OR_ADMIN]

    def get(self, request):
        requests = CitizenRequest.objects.all()
        try:
            webcup = get_webcup_requests(force=False)
            webcup_session = webcup.get("session", {})
            webcup_meta = webcup.get("meta", {})
        except WebCupUpstreamError:
            webcup_session = {}
            webcup_meta = {"upstream_available": False}

        return Response(
            {
                "requests": {
                    "total": requests.count(),
                    "pending": requests.filter(status=CitizenRequest.Status.PENDING).count(),
                    "submitted": requests.filter(status=CitizenRequest.Status.SUBMITTED).count(),
                    "in_progress": requests.filter(status=CitizenRequest.Status.IN_PROGRESS).count(),
                    "action_required": requests.filter(status=CitizenRequest.Status.ACTION_REQUIRED).count(),
                    "completed": requests.filter(status=CitizenRequest.Status.COMPLETED).count(),
                    "awaiting_handling": requests.exclude(
                        status=CitizenRequest.Status.COMPLETED
                    ).filter(assigned_to__isnull=True).count(),
                },
                "citizens": User.objects.filter(role=User.Role.CITIZEN).count(),
                "contacts_unread": ContactMessage.objects.filter(
                    status=ContactMessage.Status.RECEIVED
                ).count(),
                "webcup": {"session": webcup_session, "meta": webcup_meta},
            }
        )


class AgentRequestListView(generics.ListAPIView):
    permission_classes = [AGENT_OR_ADMIN]
    serializer_class = AgentCitizenRequestSerializer

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
        if request_status:
            queryset = queryset.filter(status=request_status)
        if service:
            queryset = queryset.filter(Q(service_id=service) | Q(service__slug=service))
        if assigned_to:
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
        return queryset


class AgentRequestSummaryView(APIView):
    permission_classes = [AGENT_OR_ADMIN]

    def get(self, request):
        queryset = CitizenRequest.objects.all()
        open_queryset = queryset.exclude(status=CitizenRequest.Status.COMPLETED)
        return Response({
            "total": queryset.count(),
            "open": open_queryset.count(),
            "awaiting_handling": open_queryset.filter(assigned_to__isnull=True).count(),
            "pending": queryset.filter(status=CitizenRequest.Status.PENDING).count(),
            "submitted": queryset.filter(status=CitizenRequest.Status.SUBMITTED).count(),
            "in_progress": queryset.filter(status=CitizenRequest.Status.IN_PROGRESS).count(),
            "action_required": queryset.filter(status=CitizenRequest.Status.ACTION_REQUIRED).count(),
            "completed": queryset.filter(status=CitizenRequest.Status.COMPLETED).count(),
            "reports": queryset.filter(request_type=CitizenRequest.RequestType.REPORT).count(),
        })


@method_decorator(name="patch", decorator=agent_request_patch_schema)
class AgentRequestDetailView(generics.RetrieveUpdateAPIView):
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

    @transaction.atomic
    def perform_update(self, serializer):
        previous_status = serializer.instance.status
        previous_priority = serializer.instance.priority
        previous_assignee = serializer.instance.assigned_to_id
        instance = serializer.save()
        _notify_request_status(instance, previous_status=previous_status)
        if previous_status != instance.status:
            _create_request_event(
                instance,
                actor=self.request.user,
                event_type=CitizenRequestEvent.EventType.STATUS,
                title=instance.get_status_display(),
                message=f"Le statut de la demande est passé à « {instance.get_status_display()} ».",
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


@method_decorator(name="post", decorator=agent_request_event_post_schema)
class AgentRequestTimelineView(generics.ListCreateAPIView):
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


class AgentCitizenListView(generics.ListAPIView):
    permission_classes = [AGENT_OR_ADMIN]
    serializer_class = AgentCitizenListSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return User.objects.none()
        queryset = User.objects.filter(role=User.Role.CITIZEN).annotate(
            request_count=Count("citizen_requests", distinct=True)
        )
        search = self.request.query_params.get("search")
        active = self.request.query_params.get("active")
        if search:
            queryset = queryset.filter(
                Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )
        if active in {"1", "true", "yes"}:
            queryset = queryset.filter(is_active=True)
        if active in {"0", "false", "no"}:
            queryset = queryset.filter(is_active=False)
        return queryset.order_by("first_name", "last_name", "email")


class AgentCitizenDetailView(generics.RetrieveAPIView):
    permission_classes = [AGENT_OR_ADMIN]
    serializer_class = AgentCitizenDetailSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return User.objects.none()
        return User.objects.filter(role=User.Role.CITIZEN).annotate(
            request_count=Count("citizen_requests", distinct=True)
        )


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
            queryset = queryset.filter(Q(service_id=service) | Q(service__slug=service))
        if assigned_to:
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
                    "published": NewsArticle.objects.filter(is_published=True).count(),
                },
                "requests": {
                    "total": citizen_requests.count(),
                    "pending": citizen_requests.filter(status=CitizenRequest.Status.PENDING).count(),
                    "in_progress": citizen_requests.filter(status=CitizenRequest.Status.IN_PROGRESS).count(),
                    "action_required": citizen_requests.filter(status=CitizenRequest.Status.ACTION_REQUIRED).count(),
                    "completed": citizen_requests.filter(status=CitizenRequest.Status.COMPLETED).count(),
                    "awaiting_handling": citizen_requests.exclude(
                        status=CitizenRequest.Status.COMPLETED
                    ).filter(assigned_to__isnull=True).count(),
                    "reports": citizen_requests.filter(
                        request_type=CitizenRequest.RequestType.REPORT
                    ).count(),
                },
                "contacts": {
                    "total": ContactMessage.objects.count(),
                    "unread": ContactMessage.objects.filter(status=ContactMessage.Status.RECEIVED).count(),
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

    def patch(self, request, *args, **kwargs):
        response = super().patch(request, *args, **kwargs)
        instance = self.get_object()
        return Response(AdminUserSerializer(instance, context={"request": request}).data)


@method_decorator(name="post", decorator=admin_service_post_schema)
class AdminServiceListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminMunicipalServiceSerializer

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

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])


@method_decorator(name="post", decorator=admin_news_post_schema)
class AdminNewsListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminNewsArticleSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return NewsArticle.objects.none()
        queryset = NewsArticle.objects.all()
        published = self.request.query_params.get("published")
        search = self.request.query_params.get("search")
        if published in {"1", "true", "yes"}:
            queryset = queryset.filter(is_published=True)
        if published in {"0", "false", "no"}:
            queryset = queryset.filter(is_published=False)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(category__icontains=search)
                | Q(content__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        article = serializer.save()
        if article.is_published:
            # Une seule notification par publication créée. Pas de fan-out sur les mises à jour.
            notifications = [
                CitizenNotification(
                    user=user,
                    kind=CitizenNotification.Kind.NEWS,
                    title=article.title,
                    message=article.excerpt or "Nouvelle information municipale disponible.",
                )
                for user in User.objects.filter(role=User.Role.CITIZEN, is_active=True).only("id")
            ]
            if notifications:
                CitizenNotification.objects.bulk_create(notifications, batch_size=500)


@method_decorator(name="patch", decorator=admin_news_patch_schema)
@method_decorator(name="delete", decorator=admin_news_delete_schema)
class AdminNewsDetailView(generics.RetrieveUpdateDestroyAPIView):
    http_method_names = ["get", "patch", "delete", "head", "options"]
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminNewsArticleSerializer
    lookup_field = "slug"
    queryset = NewsArticle.objects.all()

    def perform_destroy(self, instance):
        instance.is_published = False
        instance.save(update_fields=["is_published", "updated_at"])


class AdminContactMessageListView(AgentContactMessageListView):
    permission_classes = [IsAuthenticatedAdmin]


class AdminContactMessageDetailView(AgentContactMessageDetailView):
    permission_classes = [IsAuthenticatedAdmin]

    @admin_contact_patch_schema
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)


class AdminRequestListView(AgentRequestListView):
    permission_classes = [IsAuthenticatedAdmin]


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
