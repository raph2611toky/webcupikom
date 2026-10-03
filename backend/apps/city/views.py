from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
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
    CitizenRequest,
    ContactMessage,
    MunicipalService,
    NewsArticle,
    WebCupRequestSnapshot,
    WebCupSyncState,
)
from .serializers import (
    AdminMunicipalServiceSerializer,
    AdminNewsArticleSerializer,
    AdminUserCreateSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
    AgentCitizenDetailSerializer,
    AgentCitizenListSerializer,
    AgentCitizenRequestSerializer,
    AssigneeSerializer,
    CitizenContactMessageSerializer,
    CitizenNotificationSerializer,
    CitizenRequestSerializer,
    ContactMessageCreateSerializer,
    ContactMessageReceiptSerializer,
    ContactMessageSerializer,
    MunicipalServiceSerializer,
    NewsArticleSerializer,
    WebCupRequestSnapshotSerializer,
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


# ---------------------------------------------------------------------------
# Public
# ---------------------------------------------------------------------------


class MunicipalServiceListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = MunicipalServiceSerializer

    def get_queryset(self):
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
        return queryset


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


class ContactMessageCreateView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = ContactMessageCreateSerializer
    throttle_scope = "contact"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()

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
            }
        )


class CitizenRequestListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = CitizenRequestSerializer

    def get_queryset(self):
        queryset = CitizenRequest.objects.filter(citizen=self.request.user).select_related(
            "service", "assigned_to"
        )
        request_status = self.request.query_params.get("status")
        search = self.request.query_params.get("search")
        if request_status:
            queryset = queryset.filter(status=request_status)
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
        CitizenNotification.objects.create(
            user=self.request.user,
            kind=CitizenNotification.Kind.REQUEST,
            title=f"Demande {instance.reference} enregistrée",
            message="Votre demande a bien été transmise aux services municipaux.",
            related_request=instance,
        )


class CitizenRequestDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = CitizenRequestSerializer
    lookup_field = "reference"

    def get_queryset(self):
        return CitizenRequest.objects.filter(citizen=self.request.user).select_related(
            "service", "assigned_to"
        )


class CitizenContactMessageListView(generics.ListAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = CitizenContactMessageSerializer

    def get_queryset(self):
        return ContactMessage.objects.filter(user=self.request.user).select_related("service")


class CitizenContactMessageDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = CitizenContactMessageSerializer
    lookup_field = "reference"

    def get_queryset(self):
        return ContactMessage.objects.filter(user=self.request.user).select_related("service")


class CitizenNotificationListView(generics.ListAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = CitizenNotificationSerializer

    def get_queryset(self):
        queryset = CitizenNotification.objects.filter(user=self.request.user).select_related(
            "related_request", "related_contact"
        )
        unread = self.request.query_params.get("unread", "").strip().lower()
        if unread in {"1", "true", "yes"}:
            queryset = queryset.filter(is_read=False)
        return queryset


class CitizenNotificationDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = CitizenNotificationSerializer

    def get_queryset(self):
        return CitizenNotification.objects.filter(user=self.request.user).select_related(
            "related_request", "related_contact"
        )

    def put(self, request, *args, **kwargs):
        return Response(
            {"detail": "Utilisez PATCH pour modifier l'état de lecture."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


class CitizenNotificationReadAllView(APIView):
    permission_classes = [IsAuthenticatedCitizen]

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
        queryset = CitizenRequest.objects.select_related("citizen", "service", "assigned_to")
        request_status = self.request.query_params.get("status")
        service = self.request.query_params.get("service")
        assigned_to = self.request.query_params.get("assigned_to")
        priority = self.request.query_params.get("priority")
        search = self.request.query_params.get("search")
        if request_status:
            queryset = queryset.filter(status=request_status)
        if service:
            queryset = queryset.filter(Q(service_id=service) | Q(service__slug=service))
        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)
        if priority:
            queryset = queryset.filter(priority=priority)
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


class AgentRequestDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [AGENT_OR_ADMIN]
    serializer_class = AgentCitizenRequestSerializer
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
        instance = serializer.save()
        _notify_request_status(instance, previous_status=previous_status)


class AgentCitizenListView(generics.ListAPIView):
    permission_classes = [AGENT_OR_ADMIN]
    serializer_class = AgentCitizenListSerializer

    def get_queryset(self):
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
        return User.objects.filter(role=User.Role.CITIZEN).annotate(
            request_count=Count("citizen_requests", distinct=True)
        )


class AgentAssigneeListView(generics.ListAPIView):
    permission_classes = [AGENT_OR_ADMIN]
    serializer_class = AssigneeSerializer

    def get_queryset(self):
        return User.objects.filter(
            Q(role=User.Role.AGENT) | Q(role=User.Role.ADMIN), is_active=True
        ).order_by("role", "first_name", "last_name", "email")


class AgentContactMessageListView(generics.ListAPIView):
    permission_classes = [AGENT_OR_ADMIN]
    serializer_class = ContactMessageSerializer

    def get_queryset(self):
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


class AgentContactMessageDetailView(generics.RetrieveUpdateAPIView):
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


class AdminUserListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedAdmin]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AdminUserCreateSerializer
        return AdminUserSerializer

    def get_queryset(self):
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


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
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


class AdminServiceListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminMunicipalServiceSerializer

    def get_queryset(self):
        queryset = MunicipalService.objects.all()
        active = self.request.query_params.get("active")
        search = self.request.query_params.get("search")
        if active in {"1", "true", "yes"}:
            queryset = queryset.filter(is_active=True)
        if active in {"0", "false", "no"}:
            queryset = queryset.filter(is_active=False)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(category__icontains=search)
            )
        return queryset


class AdminServiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminMunicipalServiceSerializer
    lookup_field = "slug"
    queryset = MunicipalService.objects.all()

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])


class AdminNewsListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminNewsArticleSerializer

    def get_queryset(self):
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


class AdminNewsDetailView(generics.RetrieveUpdateDestroyAPIView):
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


class AdminRequestListView(AgentRequestListView):
    permission_classes = [IsAuthenticatedAdmin]


class AdminRequestDetailView(AgentRequestDetailView):
    permission_classes = [IsAuthenticatedAdmin]


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
