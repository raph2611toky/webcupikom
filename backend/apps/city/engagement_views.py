from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from helpers.permissions import IsAuthenticatedAdmin, IsAuthenticatedCitizen

from .engagement_swagger import (
    admin_privacy_concern_detail_schema,
    admin_privacy_concern_list_schema,
    admin_privacy_concern_patch_schema,
    admin_service_feedback_list_schema,
    privacy_concern_create_schema,
    privacy_concern_detail_schema,
    privacy_concern_list_schema,
    request_support_delete_schema,
    request_support_get_schema,
    request_support_post_schema,
    service_feedback_get_schema,
    service_feedback_patch_schema,
    service_feedback_post_schema,
    supportable_request_list_schema,
)

from .engagement_serializers import (
    AdminPrivacyConcernSerializer,
    AdminServiceFeedbackSerializer,
    CitizenPrivacyConcernSerializer,
    CitizenRequestSupportStateSerializer,
    ServiceFeedbackSerializer,
    SupportableCitizenRequestSerializer,
    SUPPORTABLE_STATUSES,
    request_support_is_allowed,
)
from .models import (
    CitizenAppointment,
    CitizenNotification,
    CitizenRequest,
    CitizenRequestSupport,
    MunicipalService,
    PrivacyConcern,
    ServiceFeedback,
    StaffAuditEvent,
)
from .services.audit import record_staff_audit


def _supportable_base_queryset():
    return CitizenRequest.objects.filter(
        request_type=CitizenRequest.RequestType.REPORT,
        duplicate_of__isnull=True,
        status__in=SUPPORTABLE_STATUSES,
    )


def _public_report_for_support(reference, user, *, require_open=False):
    queryset = CitizenRequest.objects.select_related("service").filter(
        reference=reference,
        request_type=CitizenRequest.RequestType.REPORT,
        duplicate_of__isnull=True,
    )
    instance = generics.get_object_or_404(queryset, reference=reference)
    if instance.citizen_id == user.pk:
        raise ValidationError({"request": "Vous ne pouvez pas soutenir votre propre demande."})
    if require_open and not request_support_is_allowed(instance):
        raise ValidationError({"request": "Cette demande n'accepte plus de nouveaux soutiens."})
    return instance


def _support_state(instance, citizen, *, confirmation=""):
    support = CitizenRequestSupport.objects.filter(request=instance, citizen=citizen).first()
    return {
        "reference": instance.reference,
        "supported": bool(support),
        "support_count": CitizenRequestSupport.objects.filter(request=instance).count(),
        "supported_at": support.created_at if support else None,
        "can_support": bool(
            not support
            and instance.citizen_id != citizen.pk
            and request_support_is_allowed(instance)
        ),
        "confirmation": confirmation,
    }


class SupportableCitizenRequestListView(generics.ListAPIView):
    """F52 : demandes publiques soutenables, avec projection strictement non personnelle."""

    permission_classes = [AllowAny]
    serializer_class = SupportableCitizenRequestSerializer
    throttle_scope = "citizen_participation"

    @supportable_request_list_schema
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return CitizenRequest.objects.none()
        user = self.request.user
        queryset = (
            _supportable_base_queryset()
            .select_related("service")
            .annotate(support_count=Count("request_supports", distinct=True))
        )
        if user and user.is_authenticated:
            queryset = queryset.exclude(citizen=user).annotate(
                is_supported=Exists(
                    CitizenRequestSupport.objects.filter(
                        request=OuterRef("pk"), citizen=user
                    )
                )
            )
        district = (self.request.query_params.get("district") or "").strip()
        category = (self.request.query_params.get("category") or "").strip()
        service = (self.request.query_params.get("service") or "").strip()
        search = (self.request.query_params.get("search") or "").strip()
        if district:
            queryset = queryset.filter(district__iexact=district)
        if category:
            queryset = queryset.filter(incident_category__iexact=category)
        if service:
            queryset = queryset.filter(service_id=int(service)) if service.isdigit() else queryset.filter(service__slug=service)
        if search:
            # Le texte complet n'est jamais sérialisé, mais peut aider à retrouver un sujet.
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(incident_category__icontains=search)
                | Q(district__icontains=search)
                | Q(service__name__icontains=search)
            )
        return queryset.order_by("-support_count", "-created_at", "-id")


class CitizenRequestSupportView(APIView):
    permission_classes = [IsAuthenticatedCitizen]
    throttle_scope = "citizen_participation"

    @request_support_get_schema
    def get(self, request, reference):
        instance = _public_report_for_support(reference, request.user)
        return Response(CitizenRequestSupportStateSerializer(_support_state(instance, request.user)).data)

    @request_support_post_schema
    @transaction.atomic
    def post(self, request, reference):
        instance = _public_report_for_support(reference, request.user, require_open=True)
        support, created = CitizenRequestSupport.objects.get_or_create(
            request=instance,
            citizen=request.user,
        )
        message = (
            "Votre soutien a bien été enregistré."
            if created
            else "Votre soutien était déjà enregistré."
        )
        payload = _support_state(instance, request.user, confirmation=message)
        return Response(
            CitizenRequestSupportStateSerializer(payload).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @request_support_delete_schema
    @transaction.atomic
    def delete(self, request, reference):
        instance = _public_report_for_support(reference, request.user)
        deleted, _ = CitizenRequestSupport.objects.filter(
            request=instance,
            citizen=request.user,
        ).delete()
        payload = _support_state(
            instance,
            request.user,
            confirmation=("Votre soutien a été retiré." if deleted else "Aucun soutien n'était enregistré."),
        )
        return Response(CitizenRequestSupportStateSerializer(payload).data, status=status.HTTP_200_OK)


def _feedback_sources(user, service):
    requests = list(
        CitizenRequest.objects.filter(
            citizen=user,
            service=service,
            status=CitizenRequest.Status.COMPLETED,
        ).order_by("-updated_at", "-id").values("reference", "updated_at")[:10]
    )
    appointments = list(
        CitizenAppointment.objects.filter(
            citizen=user,
            service=service,
            status=CitizenAppointment.Status.COMPLETED,
        ).order_by("-updated_at", "-id").values("reference", "updated_at")[:10]
    )
    result = [
        {"type": "request", "reference": row["reference"], "completed_at": row["updated_at"]}
        for row in requests
    ]
    result += [
        {"type": "appointment", "reference": row["reference"], "completed_at": row["updated_at"]}
        for row in appointments
    ]
    result.sort(key=lambda row: row["completed_at"], reverse=True)
    return result[:10]


class CitizenServiceFeedbackView(APIView):
    permission_classes = [IsAuthenticatedCitizen]
    throttle_scope = "service_feedback"

    def _service(self, slug):
        return generics.get_object_or_404(MunicipalService.objects.all(), slug=slug)

    @service_feedback_get_schema
    def get(self, request, slug):
        service = self._service(slug)
        feedback = ServiceFeedback.objects.select_related(
            "service", "source_request", "source_appointment"
        ).filter(citizen=request.user, service=service).first()
        sources = _feedback_sources(request.user, service)
        usage_eligible = bool(sources)
        return Response({
            "eligible": usage_eligible,
            "can_create": bool(usage_eligible and feedback is None),
            "can_update": bool(feedback is not None),
            "eligibility_reason": (
                "Votre utilisation est vérifiée. Vous pouvez modifier votre avis existant."
                if feedback is not None
                else (
                    "Vous pouvez laisser un avis après une utilisation terminée de ce service."
                    if usage_eligible
                    else "Aucune demande ou rendez-vous terminé n'a été trouvé pour ce service."
                )
            ),
            "eligible_sources": sources,
            "feedback": (
                ServiceFeedbackSerializer(feedback, context={"request": request, "service": service}).data
                if feedback else None
            ),
        })

    @service_feedback_post_schema
    @transaction.atomic
    def post(self, request, slug):
        service = self._service(slug)
        serializer = ServiceFeedbackSerializer(
            data=request.data,
            context={"request": request, "service": service},
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(
            ServiceFeedbackSerializer(instance, context={"request": request, "service": service}).data,
            status=status.HTTP_201_CREATED,
        )

    @service_feedback_patch_schema
    @transaction.atomic
    def patch(self, request, slug):
        service = self._service(slug)
        instance = generics.get_object_or_404(
            ServiceFeedback.objects.select_for_update().select_related(
                "service", "source_request", "source_appointment"
            ),
            citizen=request.user,
            service=service,
        )
        serializer = ServiceFeedbackSerializer(
            instance,
            data=request.data,
            partial=True,
            context={"request": request, "service": service},
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(ServiceFeedbackSerializer(instance, context={"request": request, "service": service}).data)


class AdminServiceFeedbackListView(generics.ListAPIView):
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminServiceFeedbackSerializer

    @admin_service_feedback_list_schema
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ServiceFeedback.objects.none()
        queryset = ServiceFeedback.objects.select_related(
            "citizen", "service", "source_request", "source_appointment"
        )
        service = (self.request.query_params.get("service") or "").strip()
        rating = (self.request.query_params.get("rating") or "").strip()
        search = (self.request.query_params.get("search") or "").strip()
        if service:
            queryset = queryset.filter(service_id=int(service)) if service.isdigit() else queryset.filter(service__slug=service)
        if rating:
            try:
                rating_value = int(rating)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"rating": "Utilisez une note entière de 1 à 5."}) from exc
            if not 1 <= rating_value <= 5:
                raise ValidationError({"rating": "Utilisez une note entière de 1 à 5."})
            queryset = queryset.filter(rating=rating_value)
        if search:
            queryset = queryset.filter(
                Q(reference__icontains=search)
                | Q(citizen__email__icontains=search)
                | Q(service__name__icontains=search)
                | Q(comment__icontains=search)
            )
        return queryset


class CitizenPrivacyConcernListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = CitizenPrivacyConcernSerializer
    throttle_scope = "privacy_concern"

    @privacy_concern_list_schema
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @privacy_concern_create_schema
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return PrivacyConcern.objects.none()
        return PrivacyConcern.objects.filter(citizen=self.request.user)

    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save()
        CitizenNotification.objects.create(
            user=self.request.user,
            kind=CitizenNotification.Kind.SYSTEM,
            title="Préoccupation vie privée enregistrée",
            message=f"Votre message {instance.reference} a bien été reçu et sera traité de manière confidentielle.",
            notification_code="privacy_concern_received",
            is_important=True,
        )


class CitizenPrivacyConcernDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = CitizenPrivacyConcernSerializer
    lookup_field = "reference"

    @privacy_concern_detail_schema
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return PrivacyConcern.objects.none()
        return PrivacyConcern.objects.filter(citizen=self.request.user)


class AdminPrivacyConcernListView(generics.ListAPIView):
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminPrivacyConcernSerializer

    @admin_privacy_concern_list_schema
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return PrivacyConcern.objects.none()
        queryset = PrivacyConcern.objects.select_related("citizen", "handled_by")
        concern_status = (self.request.query_params.get("status") or "").strip()
        topic = (self.request.query_params.get("topic") or "").strip()
        search = (self.request.query_params.get("search") or "").strip()
        if concern_status:
            queryset = queryset.filter(status=concern_status)
        if topic:
            queryset = queryset.filter(topic=topic)
        if search:
            queryset = queryset.filter(
                Q(reference__icontains=search)
                | Q(subject__icontains=search)
                | Q(message__icontains=search)
                | Q(citizen__email__icontains=search)
            )
        return queryset


class AdminPrivacyConcernDetailView(generics.RetrieveUpdateAPIView):
    http_method_names = ["get", "patch", "head", "options"]
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminPrivacyConcernSerializer
    lookup_field = "reference"
    queryset = PrivacyConcern.objects.select_related("citizen", "handled_by")

    @admin_privacy_concern_detail_schema
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @admin_privacy_concern_patch_schema
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        with transaction.atomic():
            instance = generics.get_object_or_404(
                self.get_queryset().select_for_update(),
                reference=self.kwargs["reference"],
            )
            before = {"status": instance.status, "admin_note": instance.admin_note}
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            instance = serializer.save()
            changes = {}
            if before["status"] != instance.status:
                changes["status"] = {"from": before["status"], "to": instance.status}
            if before["admin_note"] != instance.admin_note:
                changes["admin_note_changed"] = True
            if changes:
                if instance.handled_by_id != request.user.pk or instance.handled_at is None:
                    instance.handled_by = request.user
                    instance.handled_at = timezone.now()
                    instance.save(update_fields=("handled_by", "handled_at", "updated_at"))
                record_staff_audit(
                    actor=request.user,
                    action="privacy_concern.update",
                    resource_type="privacy_concern",
                    resource_id=instance.pk,
                    resource_reference=instance.reference,
                    subject_user=instance.citizen,
                    summary="Préoccupation vie privée mise à jour",
                    changes=changes,
                    request=request,
                    visibility=StaffAuditEvent.Visibility.ADMIN,
                )
        return Response(self.get_serializer(instance).data)
