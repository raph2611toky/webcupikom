from django.db.models import Count
from django.utils import timezone
from rest_framework import serializers

from .models import (
    CitizenAppointment,
    CitizenRequest,
    CitizenRequestSupport,
    MunicipalService,
    PrivacyConcern,
    ServiceFeedback,
)
from .services.reports import CATEGORIES


SUPPORTABLE_STATUSES = {
    CitizenRequest.Status.SUBMITTED,
    CitizenRequest.Status.PENDING,
    CitizenRequest.Status.IN_PROGRESS,
    CitizenRequest.Status.ACTION_REQUIRED,
}


def request_support_is_allowed(instance):
    return bool(
        instance.request_type == CitizenRequest.RequestType.REPORT
        and instance.duplicate_of_id is None
        and instance.status in SUPPORTABLE_STATUSES
    )


class SupportableCitizenRequestSerializer(serializers.ModelSerializer):
    """Projection volontairement réduite : aucune donnée personnelle du déposant."""

    public_title = serializers.SerializerMethodField()
    category_label = serializers.SerializerMethodField()
    service_name = serializers.CharField(source="service.name", read_only=True, allow_null=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    support_count = serializers.SerializerMethodField()
    is_supported = serializers.SerializerMethodField()
    can_support = serializers.SerializerMethodField()

    class Meta:
        model = CitizenRequest
        fields = (
            "reference",
            "public_title",
            "incident_category",
            "category_label",
            "district",
            "service_name",
            "status",
            "status_label",
            "created_at",
            "support_count",
            "is_supported",
            "can_support",
        )
        read_only_fields = fields

    def get_public_title(self, obj):
        category = self.get_category_label(obj)
        if category:
            return category
        if obj.service_id:
            return f"Signalement — {obj.service.name}"
        return "Signalement citoyen"

    def get_category_label(self, obj):
        return next(
            (row["label"] for row in CATEGORIES if row["code"] == obj.incident_category),
            obj.incident_category or "",
        )

    def get_support_count(self, obj):
        annotated = getattr(obj, "support_count", None)
        return int(annotated if annotated is not None else obj.request_supports.count())

    def get_is_supported(self, obj):
        annotated = getattr(obj, "is_supported", None)
        if annotated is not None:
            return bool(annotated)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return obj.request_supports.filter(citizen=user).exists()

    def get_can_support(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "role", None) == "citizen"
            and not self.get_is_supported(obj)
            and obj.citizen_id != user.pk
            and request_support_is_allowed(obj)
        )


class CitizenRequestSupportStateSerializer(serializers.Serializer):
    reference = serializers.CharField()
    supported = serializers.BooleanField()
    support_count = serializers.IntegerField()
    supported_at = serializers.DateTimeField(allow_null=True)
    can_support = serializers.BooleanField()
    confirmation = serializers.CharField(allow_blank=True)


class ServiceFeedbackSerializer(serializers.ModelSerializer):
    service_slug = serializers.CharField(source="service.slug", read_only=True)
    service_name = serializers.CharField(source="service.name", read_only=True)
    request_reference = serializers.CharField(write_only=True, required=False, allow_blank=True)
    appointment_reference = serializers.CharField(write_only=True, required=False, allow_blank=True)
    source_request_reference = serializers.CharField(source="source_request.reference", read_only=True, allow_null=True)
    source_appointment_reference = serializers.CharField(source="source_appointment.reference", read_only=True, allow_null=True)
    verified_usage = serializers.BooleanField(read_only=True)
    confirmation = serializers.SerializerMethodField()

    class Meta:
        model = ServiceFeedback
        fields = (
            "reference",
            "service_slug",
            "service_name",
            "rating",
            "comment",
            "request_reference",
            "appointment_reference",
            "source_request_reference",
            "source_appointment_reference",
            "verified_usage",
            "created_at",
            "updated_at",
            "confirmation",
        )
        read_only_fields = (
            "reference",
            "service_slug",
            "service_name",
            "source_request_reference",
            "source_appointment_reference",
            "verified_usage",
            "created_at",
            "updated_at",
            "confirmation",
        )

    def get_confirmation(self, obj):
        return f"Votre avis a bien été enregistré. Référence : {obj.reference}"

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError("La note doit être comprise entre 1 et 5.")
        return value

    def validate_comment(self, value):
        value = (value or "").strip()
        if len(value) > 3000:
            raise serializers.ValidationError("Le commentaire est limité à 3 000 caractères.")
        return value

    def validate(self, attrs):
        request = self.context["request"]
        service = self.context["service"]

        if self.instance is not None:
            if "request_reference" in self.initial_data or "appointment_reference" in self.initial_data:
                raise serializers.ValidationError(
                    "La preuve d'utilisation d'un avis existant ne peut pas être remplacée."
                )
            return attrs

        if ServiceFeedback.objects.filter(citizen=request.user, service=service).exists():
            raise serializers.ValidationError(
                {"service": "Vous avez déjà laissé un avis pour ce service. Utilisez PATCH pour le modifier."}
            )

        request_reference = (attrs.pop("request_reference", "") or "").strip()
        appointment_reference = (attrs.pop("appointment_reference", "") or "").strip()
        if request_reference and appointment_reference:
            raise serializers.ValidationError(
                "Indiquez une demande ou un rendez-vous comme preuve d'utilisation, pas les deux."
            )

        source_request = None
        source_appointment = None
        if request_reference:
            source_request = CitizenRequest.objects.filter(
                reference=request_reference,
                citizen=request.user,
                service=service,
                status=CitizenRequest.Status.COMPLETED,
            ).first()
            if source_request is None:
                raise serializers.ValidationError({
                    "request_reference": "Cette demande terminée ne correspond pas à votre compte et à ce service."
                })
        elif appointment_reference:
            source_appointment = CitizenAppointment.objects.filter(
                reference=appointment_reference,
                citizen=request.user,
                service=service,
                status=CitizenAppointment.Status.COMPLETED,
            ).first()
            if source_appointment is None:
                raise serializers.ValidationError({
                    "appointment_reference": "Ce rendez-vous terminé ne correspond pas à votre compte et à ce service."
                })
        else:
            source_request = CitizenRequest.objects.filter(
                citizen=request.user,
                service=service,
                status=CitizenRequest.Status.COMPLETED,
            ).order_by("-updated_at", "-id").first()
            source_appointment = None
            if source_request is None:
                source_appointment = CitizenAppointment.objects.filter(
                    citizen=request.user,
                    service=service,
                    status=CitizenAppointment.Status.COMPLETED,
                ).order_by("-updated_at", "-id").first()

        if source_request is None and source_appointment is None:
            raise serializers.ValidationError({
                "service": "Un avis est possible après une demande terminée ou un rendez-vous terminé pour ce service."
            })

        attrs["source_request"] = source_request
        attrs["source_appointment"] = source_appointment
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        service = self.context["service"]
        # get_or_create s'appuie sur la contrainte unique (citizen, service) et
        # évite qu'un double clic/concurrence transforme un doublon en erreur 500.
        instance, created = ServiceFeedback.objects.get_or_create(
            citizen=request.user,
            service=service,
            defaults=validated_data,
        )
        if not created:
            raise serializers.ValidationError({
                "service": "Vous avez déjà laissé un avis pour ce service. Utilisez PATCH pour le modifier."
            })
        return instance


class ServiceFeedbackStateSerializer(serializers.Serializer):
    eligible = serializers.BooleanField()
    can_create = serializers.BooleanField()
    can_update = serializers.BooleanField()
    eligibility_reason = serializers.CharField(allow_blank=True)
    eligible_sources = serializers.ListField(child=serializers.DictField(), read_only=True)
    feedback = ServiceFeedbackSerializer(allow_null=True, read_only=True)


class AdminServiceFeedbackSerializer(serializers.ModelSerializer):
    citizen_email = serializers.EmailField(source="citizen.email", read_only=True)
    service_slug = serializers.CharField(source="service.slug", read_only=True)
    service_name = serializers.CharField(source="service.name", read_only=True)
    source_request_reference = serializers.CharField(source="source_request.reference", read_only=True, allow_null=True)
    source_appointment_reference = serializers.CharField(source="source_appointment.reference", read_only=True, allow_null=True)
    verified_usage = serializers.BooleanField(read_only=True)

    class Meta:
        model = ServiceFeedback
        fields = (
            "reference",
            "citizen",
            "citizen_email",
            "service",
            "service_slug",
            "service_name",
            "rating",
            "comment",
            "verified_usage",
            "source_request_reference",
            "source_appointment_reference",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class CitizenPrivacyConcernSerializer(serializers.ModelSerializer):
    topic_label = serializers.CharField(source="get_topic_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    confirmation = serializers.SerializerMethodField()

    class Meta:
        model = PrivacyConcern
        fields = (
            "reference",
            "topic",
            "topic_label",
            "subject",
            "message",
            "status",
            "status_label",
            "created_at",
            "updated_at",
            "confirmation",
        )
        read_only_fields = (
            "reference",
            "topic_label",
            "status",
            "status_label",
            "created_at",
            "updated_at",
            "confirmation",
        )

    def get_confirmation(self, obj):
        return f"Votre préoccupation a bien été enregistrée. Référence : {obj.reference}"

    def validate_subject(self, value):
        value = (value or "").strip()
        if len(value) < 3:
            raise serializers.ValidationError("Précisez brièvement le sujet de votre préoccupation.")
        return value

    def validate_message(self, value):
        value = (value or "").strip()
        if len(value) < 10:
            raise serializers.ValidationError("Décrivez votre préoccupation en au moins 10 caractères.")
        if len(value) > 10000:
            raise serializers.ValidationError("Le message est limité à 10 000 caractères.")
        return value

    def create(self, validated_data):
        validated_data["citizen"] = self.context["request"].user
        return super().create(validated_data)


class AdminPrivacyConcernSerializer(serializers.ModelSerializer):
    citizen_email = serializers.EmailField(source="citizen.email", read_only=True, allow_null=True)
    topic_label = serializers.CharField(source="get_topic_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    handled_by_email = serializers.EmailField(source="handled_by.email", read_only=True, allow_null=True)

    class Meta:
        model = PrivacyConcern
        fields = (
            "reference",
            "citizen",
            "citizen_email",
            "topic",
            "topic_label",
            "subject",
            "message",
            "status",
            "status_label",
            "admin_note",
            "handled_by",
            "handled_by_email",
            "handled_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "reference",
            "citizen",
            "citizen_email",
            "topic",
            "topic_label",
            "subject",
            "message",
            "status_label",
            "handled_by",
            "handled_by_email",
            "handled_at",
            "created_at",
            "updated_at",
        )

    def validate_admin_note(self, value):
        value = (value or "").strip()
        if len(value) > 10000:
            raise serializers.ValidationError("La note interne est limitée à 10 000 caractères.")
        return value

    def update(self, instance, validated_data):
        previous_status = instance.status
        instance = super().update(instance, validated_data)
        if instance.status != previous_status:
            instance.handled_by = self.context["request"].user
            instance.handled_at = timezone.now()
            instance.save(update_fields=("handled_by", "handled_at", "updated_at"))
        return instance
