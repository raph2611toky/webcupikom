from decimal import Decimal
import re

from django.contrib.auth import password_validation
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import serializers
from drf_yasg.utils import swagger_serializer_method

from apps.users.models import User

from .constants import ONBOARDING_STEPS, SUPPORTED_LANGUAGE_CODES
from .report_serializers import ImageUploadMixin, RequestAttachmentSerializer
from .services.reports import route_category, save_images, check_transition, CLOSED, CATEGORIES
from .services.report_alerting import classify_report
from .models import (
    CitizenAppointment,
    CitizenNotification,
    CitizenPreference,
    CitizenRequest,
    CitizenRequestEvent,
    ContactMessage,
    CityLocation,
    MunicipalService,
    NewsArticle,
    StaffAuditEvent,
    WebCupRequestSnapshot,
)


ACTIVE_APPOINTMENT_STATUSES = (
    CitizenAppointment.Status.REQUESTED,
    CitizenAppointment.Status.CONFIRMED,
)


def _unique_slug(model, value, instance=None, max_length=180):
    base = slugify(value)[:max_length] or "item"
    candidate = base
    index = 2
    queryset = model.objects.all()
    if instance and instance.pk:
        queryset = queryset.exclude(pk=instance.pk)
    while queryset.filter(slug=candidate).exists():
        suffix = f"-{index}"
        candidate = f"{base[: max_length - len(suffix)]}{suffix}"
        index += 1
    return candidate


def _requested_language(context):
    request = context.get("request") if context else None
    raw = ""
    if request is not None:
        raw = (request.query_params.get("lang") or "").strip().lower()
    code = raw.split("-")[0] if raw else "fr"
    return code if code in SUPPORTED_LANGUAGE_CODES else "fr"


class MunicipalServiceSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    short_description = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    opening_hours = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()
    actions = serializers.SerializerMethodField()
    required_documents = serializers.SerializerMethodField()
    faq = serializers.SerializerMethodField()
    language = serializers.SerializerMethodField()
    available_languages = serializers.SerializerMethodField()
    availability = serializers.SerializerMethodField()

    class Meta:
        model = MunicipalService
        fields = (
            "id", "name", "slug", "category", "short_description", "description",
            "opening_hours", "phone", "email", "address", "actions",
            "required_documents", "faq", "is_featured", "priority_order",
            "usage_count", "language", "available_languages", "availability",
        )

    def _localized_value(self, obj, field):
        lang = _requested_language(self.context)
        if lang == "fr":
            return getattr(obj, field)
        translations = obj.translations or {}
        translated = translations.get(lang) or {}
        value = translated.get(field)
        return getattr(obj, field) if value in (None, "", []) else value

    def get_name(self, obj):
        return self._localized_value(obj, "name")

    def get_category(self, obj):
        return self._localized_value(obj, "category")

    def get_short_description(self, obj):
        return self._localized_value(obj, "short_description")

    def get_description(self, obj):
        return self._localized_value(obj, "description")

    def get_opening_hours(self, obj):
        return self._localized_value(obj, "opening_hours")

    def get_address(self, obj):
        return self._localized_value(obj, "address")

    def get_actions(self, obj):
        return self._localized_value(obj, "actions")

    def get_required_documents(self, obj):
        return self._localized_value(obj, "required_documents")

    def get_faq(self, obj):
        return self._localized_value(obj, "faq")

    def get_language(self, obj):
        return _requested_language(self.context)

    def get_available_languages(self, obj):
        languages = {"fr"}
        languages.update((obj.translations or {}).keys())
        return sorted(code for code in languages if code in SUPPORTED_LANGUAGE_CODES)

    def get_availability(self, obj):
        # Un service indisponible reste visible (F64), mais le frontend sait
        # explicitement qu'une démarche ne doit pas être démarrée dessus.
        return {
            "status": obj.availability_status,
            "is_available": obj.is_active,
            "can_start_request": obj.is_active,
            "reason": obj.unavailability_reason if not obj.is_active else "",
            "unavailable_since": obj.unavailable_since if not obj.is_active else None,
            "expected_restore_at": obj.expected_restore_at if not obj.is_active else None,
            "next_action": obj.alternative_action if not obj.is_active else "",
            "updated_at": obj.availability_updated_at,
        }


class CityLocationSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    service_slug = serializers.CharField(source="service.slug", read_only=True, allow_null=True)
    service_name = serializers.CharField(source="service.name", read_only=True, allow_null=True)
    is_emergency = serializers.BooleanField(source="is_emergency_location", read_only=True)
    distance_km = serializers.SerializerMethodField()

    class Meta:
        model = CityLocation
        fields = (
            "id", "name", "slug", "kind", "kind_label", "category", "description",
            "service", "service_slug", "service_name", "partner_name", "address",
            "district", "opening_hours", "phone", "email", "website", "latitude",
            "longitude", "transport_lines", "timetable", "practical_info",
            "is_emergency", "distance_km", "updated_at",
        )

    def get_distance_km(self, obj):
        distances = self.context.get("distance_map") or {}
        value = distances.get(obj.pk)
        return round(value, 3) if value is not None else None


class AdminCityLocationSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = CityLocation
        fields = (
            "id", "name", "slug", "kind", "kind_label", "category", "description",
            "service", "partner_name", "address", "district", "opening_hours", "phone",
            "email", "website", "latitude", "longitude", "transport_lines", "timetable",
            "practical_info", "is_active", "sort_order", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "kind_label")

    def validate(self, attrs):
        slug = attrs.get("slug")
        if slug:
            queryset = CityLocation.objects.filter(slug=slug)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError({"slug": "Ce slug est déjà utilisé."})

        lat = attrs.get("latitude", getattr(self.instance, "latitude", None))
        lon = attrs.get("longitude", getattr(self.instance, "longitude", None))
        if (lat is None) != (lon is None):
            raise serializers.ValidationError({
                "location": "Latitude et longitude doivent être renseignées ensemble."
            })
        if lat is not None and not (Decimal("-90") <= lat <= Decimal("90")):
            raise serializers.ValidationError({"latitude": "La latitude doit être comprise entre -90 et 90."})
        if lon is not None and not (Decimal("-180") <= lon <= Decimal("180")):
            raise serializers.ValidationError({"longitude": "La longitude doit être comprise entre -180 et 180."})

        kind = attrs.get("kind", getattr(self.instance, "kind", CityLocation.Kind.SERVICE))
        partner_name = attrs.get("partner_name", getattr(self.instance, "partner_name", ""))
        if kind == CityLocation.Kind.PARTNER and not (partner_name or attrs.get("name")):
            raise serializers.ValidationError({"partner_name": "Le nom du partenaire est requis."})

        for field in ("transport_lines", "timetable"):
            if field in attrs and not isinstance(attrs[field], list):
                raise serializers.ValidationError({field: "Ce champ doit être un tableau JSON."})
        if "practical_info" in attrs and not isinstance(attrs["practical_info"], dict):
            raise serializers.ValidationError({"practical_info": "Ce champ doit être un objet JSON."})
        return attrs

    def create(self, validated_data):
        if not validated_data.get("slug"):
            validated_data["slug"] = _unique_slug(
                CityLocation, validated_data.get("name", "lieu"), max_length=200
            )
        if validated_data.get("kind") == CityLocation.Kind.PARTNER and not validated_data.get("partner_name"):
            validated_data["partner_name"] = validated_data.get("name", "")
        return super().create(validated_data)


class AdminMunicipalServiceSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = MunicipalService
        fields = (
            "id", "name", "slug", "category", "short_description", "description",
            "opening_hours", "phone", "email", "address", "actions",
            "required_documents", "faq", "translations", "is_featured",
            "priority_order", "usage_count", "is_active",
            "unavailability_reason", "alternative_action", "unavailable_since",
            "expected_restore_at", "availability_updated_at", "sort_order",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "usage_count", "unavailable_since", "availability_updated_at",
            "created_at", "updated_at",
        )

    def validate(self, attrs):
        slug = attrs.get("slug")
        if slug:
            queryset = MunicipalService.objects.filter(slug=slug)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError({"slug": "Ce slug est déjà utilisé."})
        translations = attrs.get("translations")
        if translations is not None and not isinstance(translations, dict):
            raise serializers.ValidationError({"translations": "Les traductions doivent être un objet JSON."})
        return attrs

    def create(self, validated_data):
        if not validated_data.get("slug"):
            validated_data["slug"] = _unique_slug(
                MunicipalService, validated_data.get("name", "service"), max_length=180
            )
        instance = super().create(validated_data)
        if not instance.is_active:
            instance.set_availability(
                is_available=False,
                reason=instance.unavailability_reason or "Service temporairement indisponible.",
                alternative_action=instance.alternative_action,
                expected_restore_at=instance.expected_restore_at,
            )
        return instance

    def update(self, instance, validated_data):
        availability_requested = "is_active" in validated_data
        metadata_requested = any(
            field in validated_data
            for field in ("unavailability_reason", "alternative_action", "expected_restore_at")
        )
        target_is_active = validated_data.get("is_active", instance.is_active)
        reason = validated_data.get("unavailability_reason", instance.unavailability_reason)
        alternative = validated_data.get("alternative_action", instance.alternative_action)
        restore_at = validated_data.get("expected_restore_at", instance.expected_restore_at)

        # Le changement d'état est appliqué par ``set_availability`` afin que
        # l'ancien PATCH admin bénéficie aussi des nouvelles métadonnées.
        if availability_requested:
            validated_data.pop("is_active", None)
            validated_data.pop("unavailability_reason", None)
            validated_data.pop("alternative_action", None)
            validated_data.pop("expected_restore_at", None)

        instance = super().update(instance, validated_data)
        if availability_requested:
            instance.set_availability(
                is_available=target_is_active,
                reason=reason or "Service temporairement indisponible.",
                alternative_action=alternative,
                expected_restore_at=restore_at,
            )
        elif metadata_requested:
            instance.availability_updated_at = timezone.now()
            instance.save(update_fields=["availability_updated_at", "updated_at"])
        return instance


class ServiceAvailabilityUpdateSerializer(serializers.Serializer):
    is_available = serializers.BooleanField(required=True)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=300)
    alternative_action = serializers.CharField(required=False, allow_blank=True, max_length=500)
    expected_restore_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs["is_available"]:
            return attrs

        reason = (attrs.get("reason") or "").strip()
        if not reason:
            raise serializers.ValidationError({
                "reason": "Indiquez pourquoi le service est indisponible afin d'informer les citoyens."
            })
        restore_at = attrs.get("expected_restore_at")
        if restore_at and restore_at <= timezone.now():
            raise serializers.ValidationError({
                "expected_restore_at": "La date estimée de rétablissement doit être dans le futur."
            })
        attrs["reason"] = reason
        attrs["alternative_action"] = (attrs.get("alternative_action") or "").strip()
        return attrs


from .news_serializers import PublicationSerializer as NewsArticleSerializer, PublicationAdminSerializer as AdminNewsArticleSerializer


class ContactMessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ("category", "name", "email", "service", "subject", "message")

    def validate_category(self, value):
        if value == ContactMessage.Category.PRIVACY:
            request = self.context.get("request")
            user = getattr(request, "user", None)
            if not (
                user
                and user.is_authenticated
                and getattr(user, "role", None) == User.Role.CITIZEN
            ):
                raise serializers.ValidationError(
                    "Les préoccupations de confidentialité doivent être envoyées depuis un compte citoyen connecté."
                )
        return value

    def validate_service(self, value):
        if value and not value.is_active:
            raise serializers.ValidationError("Ce service n'est pas disponible.")
        return value

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["user"] = request.user
        return super().create(validated_data)


class ContactMessageReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ("reference", "category", "status", "created_at")


class ContactMessageSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
    user_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = ContactMessage
        fields = (
            "id", "reference", "category", "user", "user_name", "name", "email", "service",
            "service_name", "subject", "message", "status", "assigned_to",
            "assigned_to_name", "read_at", "closed_at", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "reference", "category", "user", "user_name", "name", "email", "service",
            "service_name", "subject", "message", "assigned_to_name", "read_at",
            "closed_at", "created_at", "updated_at",
        )

    def get_user_name(self, obj):
        if not obj.user:
            return None
        return obj.user.get_full_name().strip() or obj.user.email

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to:
            return None
        return obj.assigned_to.get_full_name().strip() or "Équipe municipale"

    def validate_assigned_to(self, value):
        if value and not (
            value.is_active
            and (value.is_superuser or getattr(value, "role", None) in {"agent", "admin"})
        ):
            raise serializers.ValidationError("Le responsable doit être un agent ou administrateur actif.")
        if (
            value
            and self.instance
            and self.instance.category == ContactMessage.Category.PRIVACY
            and not (value.is_superuser or getattr(value, "role", None) == User.Role.ADMIN)
        ):
            raise serializers.ValidationError(
                "Un message de confidentialité ne peut être attribué qu'à un administrateur."
            )
        return value

    def update(self, instance, validated_data):
        old_status = instance.status
        instance = super().update(instance, validated_data)
        now = timezone.now()
        update_fields = []
        if old_status != instance.status:
            if instance.status == ContactMessage.Status.READ and not instance.read_at:
                instance.read_at = now
                update_fields.append("read_at")
            if instance.status == ContactMessage.Status.CLOSED and not instance.closed_at:
                instance.closed_at = now
                update_fields.append("closed_at")
            if instance.status == ContactMessage.Status.RECEIVED:
                if instance.read_at:
                    instance.read_at = None
                    update_fields.append("read_at")
                if instance.closed_at:
                    instance.closed_at = None
                    update_fields.append("closed_at")
        if update_fields:
            update_fields.append("updated_at")
            instance.save(update_fields=update_fields)
        return instance


class CitizenContactMessageSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)

    class Meta:
        model = ContactMessage
        fields = (
            "reference", "category", "service", "service_name", "subject", "message", "status",
            "created_at", "updated_at",
        )
        read_only_fields = fields


class CitizenRequestEventSerializer(serializers.ModelSerializer):
    attachments = serializers.SerializerMethodField()
    actor_role = serializers.CharField(source="actor.role", read_only=True, allow_null=True)

    @swagger_serializer_method(serializer_or_field=RequestAttachmentSerializer(many=True))
    def get_attachments(self, obj):
        request = self.context.get("request")
        images = obj.attachments.all()
        if request and getattr(request.user, "role", "") == "citizen":
            images = images.filter(is_public=True).filter(Q(event__isnull=True) | Q(event__is_public=True))
        return RequestAttachmentSerializer(images, many=True, context=self.context).data

    actor_name = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = CitizenRequestEvent
        fields = (
            "id", "event_type", "status", "status_label", "title", "message",
            "actor_name", "actor_role", "attachments", "is_public", "created_at",
        )
        read_only_fields = fields

    def get_actor_name(self, obj):
        if not obj.actor:
            return None
        return obj.actor.get_full_name().strip() or "Équipe municipale"

    def get_status_label(self, obj):
        return obj.get_status_display() if obj.status else None


class AgentRequestEventCreateSerializer(ImageUploadMixin, serializers.ModelSerializer):
    is_public = serializers.BooleanField(default=True)
    class Meta:
        model = CitizenRequestEvent
        fields = ("title", "message", "is_public", "images", "image", "image_captions")

    def validate(self, attrs):
        attrs = self.validate_images_payload(attrs)
        if len(attrs.get('message', '')) > 10000:
            raise serializers.ValidationError({'message': '10 000 caractères maximum.'})
        return attrs

    def create(self, validated_data):
        images = validated_data.pop('images', [])
        captions = validated_data.pop('image_captions', [])
        item = self.context['citizen_request']
        validated_data['request'] = item
        validated_data['actor'] = self.context['request'].user
        validated_data['event_type'] = CitizenRequestEvent.EventType.NOTE
        validated_data['status'] = item.status
        if item.request_type == 'report' and item.status in CLOSED and validated_data.get('is_public', True):
            raise serializers.ValidationError('Réouvrez le dossier pour ajouter une étape publique.')
        instance = super().create(validated_data)
        save_images(item, images, uploader=instance.actor, event=instance,
                    is_public=instance.is_public, captions=captions)
        from .services.reports import notify_citizen
        if item.request_type == 'report' and instance.is_public:
            notify_citizen(item, instance.actor, instance.message or 'Une nouvelle étape est disponible.')
        return instance


class CitizenRequestSerializer(ImageUploadMixin, serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    priority_label = serializers.CharField(source='get_priority_display', read_only=True)
    severity_label = serializers.CharField(source='get_severity_display', read_only=True)
    category_label = serializers.SerializerMethodField()
    is_closed = serializers.SerializerMethodField()
    workflow_state = serializers.SerializerMethodField()
    requires_agent_action = serializers.SerializerMethodField()
    requires_citizen_action = serializers.SerializerMethodField()
    available_actions = serializers.SerializerMethodField()
    support_count = serializers.SerializerMethodField()

    def get_support_count(self, obj) -> int:
        value = getattr(obj, "support_count", None)
        return int(value if value is not None else obj.request_supports.count())

    def get_category_label(self, obj) -> str:
        return next((row['label'] for row in CATEGORIES if row['code'] == obj.incident_category), obj.incident_category)

    def get_is_closed(self, obj) -> bool:
        return obj.status in CLOSED

    def get_workflow_state(self, obj) -> str:
        if obj.status in CLOSED:
            return "closed"
        if obj.status == CitizenRequest.Status.ACTION_REQUIRED:
            return "citizen_action_required"
        if obj.status in (CitizenRequest.Status.SUBMITTED, CitizenRequest.Status.PENDING) and not obj.acknowledged_at:
            return "awaiting_handling"
        return "agent_processing"

    def get_requires_agent_action(self, obj) -> bool:
        return obj.status in (
            CitizenRequest.Status.SUBMITTED,
            CitizenRequest.Status.PENDING,
            CitizenRequest.Status.IN_PROGRESS,
        )

    def get_requires_citizen_action(self, obj) -> bool:
        return obj.status == CitizenRequest.Status.ACTION_REQUIRED

    @swagger_serializer_method(serializer_or_field=serializers.ListField(child=serializers.CharField()))
    def get_available_actions(self, obj):
        request = self.context.get('request')
        if not request or obj.request_type != 'report':
            return []
        if request.user.role in ('agent', 'admin'):
            if obj.status in ('completed', 'rejected'):
                return ['reopen', 'add_private_note', 'find_similar']
            if obj.status == 'cancelled':
                return ['add_private_note', 'find_similar']
            duplicate_action = 'unlink_duplicate' if obj.duplicate_of_id else 'mark_duplicate'
            actions = ['update_processing', 'add_note', 'upload_photos', 'find_similar', duplicate_action]
            if (
                obj.handling_route == CitizenRequest.HandlingRoute.EMERGENCY
                and obj.alert_status != CitizenRequest.AlertStatus.ACKNOWLEDGED
            ):
                actions.insert(0, 'acknowledge_alert')
            return actions
        if request.user.pk != obj.citizen_id:
            return []
        if obj.status in ('completed','rejected'):
            return ['reopen']
        if obj.status == 'cancelled':
            return []
        actions = ['add_message','upload_photos','cancel']
        if obj.status in ('submitted','pending'):
            actions.append('edit')
        return actions

    allow_contact = serializers.BooleanField(default=True)
    attachments = serializers.SerializerMethodField()
    attachment_count = serializers.SerializerMethodField()
    needs_triage = serializers.SerializerMethodField()

    def visible_attachments(self, obj):
        images = list(obj.attachments.all())
        request = self.context.get('request')
        if request and getattr(request.user, 'role', '') == 'citizen':
            images = [image for image in images if image.is_public and (not image.event_id or image.event.is_public)]
        return images

    @swagger_serializer_method(serializer_or_field=RequestAttachmentSerializer(many=True))
    def get_attachments(self, obj):
        return RequestAttachmentSerializer(self.visible_attachments(obj), many=True, context=self.context).data

    def get_attachment_count(self, obj) -> int:
        return len(self.visible_attachments(obj))

    def get_needs_triage(self, obj) -> bool:
        return obj.request_type == "report" and obj.service_id is None and obj.status not in CLOSED

    service_name = serializers.CharField(source="service.name", read_only=True)
    citizen_name = serializers.SerializerMethodField()
    citizen_email = serializers.EmailField(source="citizen.email", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = CitizenRequest
        fields = (
            "id", "reference", "status_label", "priority_label", "severity_label", "category_label", "is_closed", "workflow_state", "requires_agent_action", "requires_citizen_action", "available_actions", "support_count", "citizen", "citizen_name", "citizen_email",
            "service", "service_name", "request_type", "incident_category", "title",
            "description", "location_text", "latitude", "longitude", "status", "priority",
            "handling_route", "alert_status", "alert_triggered_at", "alert_acknowledged_at",
            "assigned_to", "assigned_to_name", "created_at", "updated_at",
            'district', 'street', 'building', 'landmark', 'location_accuracy', 'occurred_at', 'frequency', 'infrastructure_id', 'severity', 'danger_present', 'people_affected', 'impacts_accessibility', 'accessibility_details', 'allow_contact', 'preferred_contact', 'contact_phone', 'routing_source', 'needs_triage', 'resolution_summary', 'acknowledged_at', 'resolved_at', 'closed_at', 'cancellation_reason', 'reopened_count', 'attachments', 'attachment_count', 'images', 'image', 'image_captions',
        )
        read_only_fields = (
            'id', 'reference', 'citizen', 'citizen_name', 'citizen_email',
            'status', 'priority', 'handling_route', 'alert_status', 'alert_triggered_at',
            'alert_acknowledged_at', 'assigned_to', 'assigned_to_name',
            'created_at', 'updated_at', 'routing_source', 'needs_triage', 'resolution_summary', 'acknowledged_at',
            'resolved_at', 'closed_at', 'cancellation_reason', 'reopened_count',
            'attachments', 'attachment_count',
        )

    def get_citizen_name(self, obj):
        return obj.citizen.get_full_name().strip() or obj.citizen.email

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to:
            return None
        return obj.assigned_to.get_full_name().strip() or "Équipe municipale"

    def validate_service(self, value):
        if value and not value.is_active:
            raise serializers.ValidationError("Ce service n'est pas disponible.")
        return value

    def validate_latitude(self, value):
        if value is not None and not (Decimal("-90") <= value <= Decimal("90")):
            raise serializers.ValidationError("La latitude doit être comprise entre -90 et 90.")
        return value

    def validate_longitude(self, value):
        if value is not None and not (Decimal("-180") <= value <= Decimal("180")):
            raise serializers.ValidationError("La longitude doit être comprise entre -180 et 180.")
        return value

    def validate(self, attrs):
        attrs = self.validate_images_payload(attrs)
        instance = self.instance
        value = lambda name, default=None: attrs.get(name, getattr(instance, name, default))
        lat, lon = value('latitude'), value('longitude')
        if (lat is None) != (lon is None):
            raise serializers.ValidationError('Latitude et longitude doivent être fournies ensemble.')
        if value('location_accuracy') is not None and not 0 <= value('location_accuracy') <= 10000:
            raise serializers.ValidationError({'location_accuracy': 'Précision entre 0 et 10 000 mètres.'})
        if value('occurred_at') and value('occurred_at') > timezone.now():
            raise serializers.ValidationError({'occurred_at': 'La date d’observation ne peut pas être dans le futur.'})
        if len(value('description', '') or '') > 20000 or len(value('accessibility_details', '') or '') > 2000:
            raise serializers.ValidationError('Description : 20 000 caractères maximum ; accessibilité : 2 000.')
        request_type = value('request_type', 'procedure')
        if isinstance(self, CitizenIssueReportSerializer):
            request_type = 'report'
        if request_type == 'report':
            if not (str(value('location_text', '') or '').strip() or (lat is not None and lon is not None)):
                raise serializers.ValidationError({'location_text': 'Indiquez un lieu ou une paire de coordonnées GPS.'})
            phone = value('contact_phone', '') or self.context['request'].user.phone_number
            if phone and not re.fullmatch(r'[+0-9() .-]{5,32}', phone):
                raise serializers.ValidationError({'contact_phone': 'Numéro de téléphone invalide.'})
            if value('allow_contact', True) and value('preferred_contact', 'platform') == 'phone' and not phone:
                raise serializers.ValidationError({'contact_phone': 'Indiquez un téléphone pour être contacté par téléphone.'})
        return attrs

    def create(self, validated_data):
        images = validated_data.pop('images', [])
        captions = validated_data.pop('image_captions', [])
        validated_data['citizen'] = self.context['request'].user
        if validated_data.get('request_type') == 'report':
            category, suggested_service = route_category(validated_data.get('incident_category'))
            validated_data['incident_category'] = category
            if validated_data.get('service'):
                validated_data['routing_source'] = 'manual'
            elif suggested_service:
                validated_data['service'] = suggested_service
                validated_data['routing_source'] = 'automatic'
            handling_route, priority = classify_report(
                incident_category=validated_data.get('incident_category'),
                severity=validated_data.get('severity'),
                danger_present=validated_data.get('danger_present'),
            )
            validated_data['handling_route'] = handling_route
            validated_data['priority'] = priority
            if handling_route == CitizenRequest.HandlingRoute.EMERGENCY:
                validated_data['alert_status'] = CitizenRequest.AlertStatus.PENDING
                validated_data['alert_triggered_at'] = timezone.now()
            else:
                validated_data['alert_status'] = CitizenRequest.AlertStatus.NONE
            if not validated_data.get('contact_phone'):
                validated_data['contact_phone'] = validated_data['citizen'].phone_number
        instance = super().create(validated_data)
        save_images(instance, images, uploader=instance.citizen, captions=captions)
        return instance

    def update(self, instance, validated_data):
        images = validated_data.pop('images', [])
        captions = validated_data.pop('image_captions', [])
        validated_data.pop('request_type', None)
        manual_service = 'service' in validated_data
        if 'incident_category' in validated_data and not manual_service:
            category, suggested_service = route_category(validated_data['incident_category'])
            validated_data['incident_category'] = category
            if instance.routing_source != 'manual':
                validated_data['service'] = suggested_service
                validated_data['routing_source'] = 'automatic' if suggested_service else 'unassigned'
        if manual_service:
            validated_data['routing_source'] = 'manual' if validated_data['service'] else 'unassigned'
        if instance.request_type == CitizenRequest.RequestType.REPORT:
            category = validated_data.get('incident_category', instance.incident_category)
            severity = validated_data.get('severity', instance.severity)
            danger_present = validated_data.get('danger_present', instance.danger_present)
            handling_route, priority = classify_report(
                incident_category=category, severity=severity, danger_present=danger_present
            )
            # Une alerte déjà diffusée/prise en charge ne peut pas être effacée
            # silencieusement par une édition citoyenne.
            if not (
                instance.handling_route == CitizenRequest.HandlingRoute.EMERGENCY
                and instance.alert_status in {
                    CitizenRequest.AlertStatus.DISPATCHED,
                    CitizenRequest.AlertStatus.ACKNOWLEDGED,
                }
                and handling_route != CitizenRequest.HandlingRoute.EMERGENCY
            ):
                validated_data['handling_route'] = handling_route
                validated_data['priority'] = priority
                if handling_route == CitizenRequest.HandlingRoute.EMERGENCY:
                    if instance.alert_status == CitizenRequest.AlertStatus.NONE:
                        validated_data['alert_status'] = CitizenRequest.AlertStatus.PENDING
                    if not instance.alert_triggered_at:
                        validated_data['alert_triggered_at'] = timezone.now()
                elif instance.alert_status in {CitizenRequest.AlertStatus.NONE, CitizenRequest.AlertStatus.PENDING}:
                    validated_data['alert_status'] = CitizenRequest.AlertStatus.NONE
                    validated_data['alert_triggered_at'] = None
        instance = super().update(instance, validated_data)
        save_images(instance, images, uploader=self.context['request'].user, captions=captions)
        return instance


class CitizenIssueReportSerializer(CitizenRequestSerializer):
    class Meta(CitizenRequestSerializer.Meta):
        fields = CitizenRequestSerializer.Meta.fields
        read_only_fields = CitizenRequestSerializer.Meta.read_only_fields + ("request_type",)

    def create(self, validated_data):
        validated_data["request_type"] = CitizenRequest.RequestType.REPORT
        return super().create(validated_data)


class CitizenRequestDetailSerializer(CitizenRequestSerializer):
    timeline = serializers.SerializerMethodField()

    class Meta(CitizenRequestSerializer.Meta):
        fields = CitizenRequestSerializer.Meta.fields + ("timeline",)
        read_only_fields = CitizenRequestSerializer.Meta.read_only_fields + ("timeline",)

    @swagger_serializer_method(serializer_or_field=CitizenRequestEventSerializer(many=True))
    def get_timeline(self, obj):
        queryset = obj.timeline_events.filter(is_public=True).select_related("actor")
        return CitizenRequestEventSerializer(queryset, many=True, context=self.context).data


class AgentCitizenRequestSerializer(CitizenRequestSerializer):
    service = serializers.PrimaryKeyRelatedField(queryset=MunicipalService.objects.filter(is_active=True), required=False, allow_null=True)
    duplicate_of = serializers.PrimaryKeyRelatedField(queryset=CitizenRequest.objects.filter(request_type='report'), required=False, allow_null=True)
    is_duplicate = serializers.SerializerMethodField()
    duplicate_of_reference = serializers.CharField(source='duplicate_of.reference', read_only=True, allow_null=True)
    duplicate_of_title = serializers.CharField(source='duplicate_of.title', read_only=True, allow_null=True)
    alert_acknowledged_by = serializers.PrimaryKeyRelatedField(read_only=True)
    alert_acknowledged_by_name = serializers.SerializerMethodField()

    class Meta(CitizenRequestSerializer.Meta):
        fields = CitizenRequestSerializer.Meta.fields + (
            'duplicate_of', 'is_duplicate', 'duplicate_of_reference', 'duplicate_of_title',
            'alert_acknowledged_by', 'alert_acknowledged_by_name',
        )
        read_only_fields = tuple(name for name in CitizenRequestSerializer.Meta.fields
                                if name not in ('status', 'priority', 'assigned_to', 'service', 'resolution_summary')) + (
            'is_duplicate', 'duplicate_of_reference', 'duplicate_of_title',
            'alert_acknowledged_by', 'alert_acknowledged_by_name',
        )

    def get_is_duplicate(self, obj) -> bool:
        return bool(obj.duplicate_of_id)

    def get_alert_acknowledged_by_name(self, obj):
        user = obj.alert_acknowledged_by
        if not user:
            return None
        return user.get_full_name().strip() or user.email

    def validate(self, attrs):
        allowed = {'status','priority','assigned_to','service','resolution_summary','duplicate_of'}
        extra = set(self.initial_data) - allowed
        if extra:
            raise serializers.ValidationError({field: 'Champ non modifiable par un agent.' for field in extra})
        # Agent updates affect processing, not the original observation payload.
        if self.instance and self.instance.request_type != 'report' and 'duplicate_of' in attrs:
            raise serializers.ValidationError({
                'duplicate_of': 'Seuls les signalements peuvent être marqués comme doublons.'
            })
        if self.instance and self.instance.request_type == 'report':
            if self.instance.status in CLOSED:
                raise serializers.ValidationError('Réouvrez le dossier avant de modifier son traitement.')
            target = attrs.get('status', self.instance.status)
            check_transition(self.instance, target, attrs.get('resolution_summary', ''))
            duplicate = attrs.get('duplicate_of')
            seen = {self.instance.pk}
            while duplicate:
                duplicate = CitizenRequest.objects.select_for_update().get(pk=duplicate.pk)
                if len(seen) > 200:
                    raise serializers.ValidationError({'duplicate_of': 'Chaîne de doublons trop longue.'})
                if duplicate.pk in seen:
                    raise serializers.ValidationError({'duplicate_of': 'Un dossier ne peut pas former une boucle de doublons.'})
                seen.add(duplicate.pk)
                duplicate = duplicate.duplicate_of
            if 'resolution_summary' in attrs and len(attrs['resolution_summary']) > 10000:
                raise serializers.ValidationError({'resolution_summary': '10 000 caractères maximum.'})
        return attrs

    def update(self, instance, validated_data):
        previous = instance.status
        if 'service' in validated_data:
            validated_data['routing_source'] = 'manual' if validated_data['service'] else 'unassigned'
        status_value = validated_data.get('status', previous)
        if status_value != previous:
            if (
                not instance.acknowledged_at
                and status_value not in (CitizenRequest.Status.SUBMITTED, CitizenRequest.Status.PENDING)
            ):
                validated_data['acknowledged_at'] = timezone.now()
            if status_value in CLOSED:
                validated_data['closed_at'] = timezone.now()
                validated_data['resolved_at'] = timezone.now() if status_value == CitizenRequest.Status.COMPLETED else None
        # Do not invoke citizen edit/routing logic on agent updates.
        return serializers.ModelSerializer.update(self, instance, validated_data)

    def validate_assigned_to(self, value):
        if value and not (
            value.is_active
            and (value.is_superuser or getattr(value, "role", None) in {"agent", "admin"})
        ):
            raise serializers.ValidationError("La demande ne peut être assignée qu'à un agent ou administrateur actif.")
        return value


class SimilarCitizenRequestSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    reference = serializers.CharField()
    title = serializers.CharField()
    description_excerpt = serializers.CharField()
    status = serializers.CharField()
    status_label = serializers.CharField()
    priority = serializers.CharField()
    incident_category = serializers.CharField(allow_blank=True)
    district = serializers.CharField(allow_blank=True)
    service_id = serializers.IntegerField(allow_null=True)
    service_name = serializers.CharField(allow_null=True)
    created_at = serializers.DateTimeField()
    duplicate_of = serializers.IntegerField(allow_null=True)
    duplicate_of_reference = serializers.CharField(allow_null=True)
    score = serializers.FloatField()
    similarity_percent = serializers.IntegerField()
    reasons = serializers.ListField(child=serializers.CharField())
    distance_meters = serializers.FloatField(allow_null=True)


class SimilarCitizenRequestResponseSerializer(serializers.Serializer):
    request_id = serializers.IntegerField()
    request_reference = serializers.CharField()
    threshold = serializers.FloatField()
    count = serializers.IntegerField()
    results = SimilarCitizenRequestSerializer(many=True)


class AgentCitizenRequestDetailSerializer(AgentCitizenRequestSerializer):
    timeline = serializers.SerializerMethodField()

    class Meta(AgentCitizenRequestSerializer.Meta):
        fields = AgentCitizenRequestSerializer.Meta.fields + ("timeline",)
        read_only_fields = AgentCitizenRequestSerializer.Meta.read_only_fields + ("timeline",)

    @swagger_serializer_method(serializer_or_field=CitizenRequestEventSerializer(many=True))
    def get_timeline(self, obj):
        queryset = obj.timeline_events.select_related("actor").all()
        return CitizenRequestEventSerializer(queryset, many=True, context=self.context).data


def _validate_appointment_conflicts(*, citizen, agent, starts_at, ends_at, instance=None):
    overlapping = CitizenAppointment.objects.filter(
        status__in=ACTIVE_APPOINTMENT_STATUSES,
        starts_at__lt=ends_at,
        ends_at__gt=starts_at,
    )
    if instance and instance.pk:
        overlapping = overlapping.exclude(pk=instance.pk)
    if overlapping.filter(agent=agent).exists():
        raise serializers.ValidationError(
            {"starts_at": "Cet agent a déjà un rendez-vous qui chevauche ce créneau."}
        )
    if overlapping.filter(citizen=citizen).exists():
        raise serializers.ValidationError(
            {"starts_at": "Vous avez déjà un rendez-vous qui chevauche ce créneau."}
        )


class AppointmentAgentSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "display_name")

    def get_display_name(self, obj):
        return obj.get_full_name().strip() or obj.email


class CitizenAppointmentSerializer(serializers.ModelSerializer):
    citizen_name = serializers.SerializerMethodField()
    agent_name = serializers.SerializerMethodField()
    service_name = serializers.CharField(source="service.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    preparation_documents = serializers.SerializerMethodField()
    slot = serializers.SerializerMethodField()
    preparation = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()

    class Meta:
        model = CitizenAppointment
        fields = (
            "id", "reference", "citizen", "citizen_name", "agent", "agent_name",
            "service", "service_name", "starts_at", "ends_at", "reason", "details",
            "location", "preparation_instructions", "preparation_documents", "slot",
            "preparation", "can_cancel", "status", "status_label", "reminder_enabled",
            "reminder_minutes_before", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "reference", "citizen", "citizen_name", "agent_name", "service_name",
            "location", "preparation_instructions", "preparation_documents", "slot",
            "preparation", "can_cancel", "status", "status_label", "created_at", "updated_at",
        )

    def get_citizen_name(self, obj):
        return obj.citizen.get_full_name().strip() or obj.citizen.email

    def get_agent_name(self, obj):
        return obj.agent.get_full_name().strip() or obj.agent.email

    def get_preparation_documents(self, obj):
        return list(obj.service.required_documents or []) if obj.service else []

    def get_slot(self, obj):
        duration = max(0, int((obj.ends_at - obj.starts_at).total_seconds() // 60))
        return {
            "starts_at": obj.starts_at,
            "ends_at": obj.ends_at,
            "duration_minutes": duration,
            "timezone": timezone.get_current_timezone_name(),
        }

    def get_preparation(self, obj):
        documents = self.get_preparation_documents(obj)
        return {
            "location": obj.location or (obj.service.address if obj.service else ""),
            "instructions": obj.preparation_instructions,
            "documents": documents,
            "is_ready": bool((obj.location or (obj.service and obj.service.address)) or obj.preparation_instructions or documents),
        }

    def get_can_cancel(self, obj):
        return obj.status in ACTIVE_APPOINTMENT_STATUSES and obj.ends_at > timezone.now()

    def validate_agent(self, value):
        if not value.is_active or getattr(value, "role", None) != User.Role.AGENT:
            raise serializers.ValidationError("Sélectionnez un agent municipal actif.")
        return value

    def validate_service(self, value):
        if value and not value.is_active:
            raise serializers.ValidationError("Ce service n'est pas disponible.")
        return value

    def validate_reminder_minutes_before(self, value):
        if value < 1 or value > 10080:
            raise serializers.ValidationError("Le rappel doit être compris entre 1 minute et 7 jours avant le rendez-vous.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance
        request = self.context.get("request")
        citizen = instance.citizen if instance else getattr(request, "user", None)
        agent = attrs.get("agent", instance.agent if instance else None)
        starts_at = attrs.get("starts_at", instance.starts_at if instance else None)
        ends_at = attrs.get("ends_at", instance.ends_at if instance else None)

        next_status = attrs.get(
            "status",
            instance.status if instance else CitizenAppointment.Status.REQUESTED,
        )
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({"ends_at": "La fin du rendez-vous doit être postérieure au début."})
        if (
            starts_at
            and starts_at <= timezone.now()
            and next_status in ACTIVE_APPOINTMENT_STATUSES
            and (not instance or "starts_at" in attrs)
        ):
            raise serializers.ValidationError({"starts_at": "Le rendez-vous doit être planifié dans le futur."})
        if (
            citizen
            and agent
            and starts_at
            and ends_at
            and next_status in ACTIVE_APPOINTMENT_STATUSES
        ):
            _validate_appointment_conflicts(
                citizen=citizen,
                agent=agent,
                starts_at=starts_at,
                ends_at=ends_at,
                instance=instance,
            )
        return attrs

    def create(self, validated_data):
        citizen = self.context["request"].user
        agent = validated_data["agent"]
        service = validated_data.get("service")
        if service and not validated_data.get("location"):
            validated_data["location"] = service.address

        with transaction.atomic():
            # Les verrous utilisateurs sérialisent les réservations concurrentes
            # pour le citoyen et l'agent, même sur MySQL/SQLite sans exclusion range.
            list(
                User.objects.select_for_update()
                .filter(pk__in=sorted({citizen.pk, agent.pk}))
                .order_by("pk")
            )
            _validate_appointment_conflicts(
                citizen=citizen,
                agent=agent,
                starts_at=validated_data["starts_at"],
                ends_at=validated_data["ends_at"],
            )
            validated_data["citizen"] = citizen
            return super().create(validated_data)


class CitizenAppointmentUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CitizenAppointment
        fields = ("status", "reminder_enabled", "reminder_minutes_before")

    def validate_status(self, value):
        if value != CitizenAppointment.Status.CANCELLED:
            raise serializers.ValidationError("Un citoyen peut uniquement annuler son rendez-vous.")
        if self.instance.status in {
            CitizenAppointment.Status.CANCELLED,
            CitizenAppointment.Status.DECLINED,
            CitizenAppointment.Status.COMPLETED,
        }:
            raise serializers.ValidationError("Ce rendez-vous ne peut plus être annulé.")
        return value

    def validate_reminder_minutes_before(self, value):
        if value < 1 or value > 10080:
            raise serializers.ValidationError("Le rappel doit être compris entre 1 minute et 7 jours avant le rendez-vous.")
        return value


class AgentAppointmentSerializer(CitizenAppointmentSerializer):
    citizen_email = serializers.EmailField(source="citizen.email", read_only=True)

    class Meta(CitizenAppointmentSerializer.Meta):
        fields = CitizenAppointmentSerializer.Meta.fields + ("citizen_email",)
        read_only_fields = (
            "id", "reference", "citizen", "citizen_name", "citizen_email",
            "agent", "agent_name", "service", "service_name", "reason", "details",
            "preparation_documents", "status_label", "reminder_enabled",
            "reminder_minutes_before", "created_at", "updated_at",
        )

    def validate_status(self, value):
        if value not in CitizenAppointment.Status.values:
            raise serializers.ValidationError("Statut de rendez-vous invalide.")
        return value

    def update(self, instance, validated_data):
        starts_at = validated_data.get("starts_at", instance.starts_at)
        ends_at = validated_data.get("ends_at", instance.ends_at)
        with transaction.atomic():
            list(
                User.objects.select_for_update()
                .filter(pk__in=sorted({instance.citizen_id, instance.agent_id}))
                .order_by("pk")
            )
            next_status = validated_data.get("status", instance.status)
            if next_status in ACTIVE_APPOINTMENT_STATUSES:
                _validate_appointment_conflicts(
                    citizen=instance.citizen,
                    agent=instance.agent,
                    starts_at=starts_at,
                    ends_at=ends_at,
                    instance=instance,
                )
            return super().update(instance, validated_data)


class NotificationCreateSerializer(serializers.Serializer):
    audience = serializers.ChoiceField(choices=("global", "targeted"))
    recipient = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.CITIZEN, is_active=True),
        required=False,
        allow_null=True,
    )
    title = serializers.CharField(max_length=220)
    message = serializers.CharField(required=False, allow_blank=True)
    action_label = serializers.CharField(max_length=120, required=False, allow_blank=True)
    action_url = serializers.CharField(max_length=500, required=False, allow_blank=True)
    visible_from = serializers.DateTimeField(required=False, default=timezone.now)
    is_important = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        audience = attrs["audience"]
        recipient = attrs.get("recipient")
        request = self.context.get("request")
        if audience == "targeted" and not recipient:
            raise serializers.ValidationError({"recipient": "Le citoyen destinataire est obligatoire pour une notification ciblée."})
        if audience == "global" and recipient:
            raise serializers.ValidationError({"recipient": "Une notification globale ne doit pas avoir de destinataire unique."})
        if request and request.user.role == User.Role.AGENT and audience == "global":
            raise serializers.ValidationError({"audience": "Un agent peut envoyer uniquement des notifications ciblées."})
        return attrs


class CitizenNotificationSerializer(serializers.ModelSerializer):
    news_slug = serializers.CharField(source="related_news.slug", read_only=True, allow_null=True)
    news_publication_type = serializers.CharField(source="related_news.publication_type", read_only=True, allow_null=True)
    news_severity = serializers.CharField(source="related_news.severity", read_only=True, allow_null=True)
    news_expires_at = serializers.DateTimeField(source="related_news.expires_at", read_only=True, allow_null=True)
    request_reference = serializers.CharField(source="related_request.reference", read_only=True)
    contact_reference = serializers.CharField(source="related_contact.reference", read_only=True)
    appointment_reference = serializers.CharField(source="related_appointment.reference", read_only=True)
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = CitizenNotification
        fields = (
            "id", "kind", "scope", "title", "message", "sender", "sender_name",
            "action_label", "action_url", "request_reference", "contact_reference",
            "appointment_reference", "news_slug", "news_publication_type", "news_severity",
            "news_expires_at", "visible_from", "is_important", "is_read", "read_at", "created_at",
        )
        read_only_fields = (
            "id", "kind", "scope", "title", "message", "sender", "sender_name",
            "action_label", "action_url", "request_reference", "contact_reference",
            "appointment_reference", "news_slug", "news_publication_type", "news_severity",
            "news_expires_at", "visible_from", "is_important", "read_at", "created_at",
        )

    def get_sender_name(self, obj):
        if not obj.sender:
            return None
        return obj.sender.get_full_name().strip() or obj.sender.email

    def update(self, instance, validated_data):
        is_read = validated_data.get("is_read", instance.is_read)
        instance.is_read = is_read
        instance.read_at = timezone.now() if is_read else None
        instance.save(update_fields=["is_read", "read_at"])
        return instance


class CitizenPreferenceSerializer(serializers.ModelSerializer):
    language = serializers.CharField(required=False)
    onboarding_completed = serializers.SerializerMethodField()

    class Meta:
        model = CitizenPreference
        fields = (
            "language", "screen_reader_mode", "high_contrast", "font_scale",
            "onboarding_step", "onboarding_completed", "onboarding_completed_at", "updated_at",
        )
        read_only_fields = ("onboarding_completed", "onboarding_completed_at", "updated_at")

    def get_onboarding_completed(self, obj):
        return obj.onboarding_completed_at is not None

    def validate_language(self, value):
        code = value.strip().lower().split("-")[0]
        if code not in SUPPORTED_LANGUAGE_CODES:
            raise serializers.ValidationError("Langue non prise en charge.")
        return code

    def validate_font_scale(self, value):
        if value < 80 or value > 180:
            raise serializers.ValidationError("La taille du texte doit être comprise entre 80 et 180 %.")
        return value

    def validate_onboarding_step(self, value):
        value = value.strip().lower()
        if value not in ONBOARDING_STEPS:
            raise serializers.ValidationError("Étape d'onboarding invalide.")
        return value

    def update(self, instance, validated_data):
        language = validated_data.pop("language", None)
        instance = super().update(instance, validated_data)
        if language and instance.user.locale != language:
            instance.user.locale = language
            instance.user.save(update_fields=["locale", "updated_at"])
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["language"] = (instance.user.locale or "fr").split("-")[0]
        return data


class AgentCitizenListSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    request_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id", "email", "first_name", "last_name", "display_name", "phone_number",
            "email_verified", "is_active", "date_joined", "last_login", "request_count",
        )

    def get_display_name(self, obj):
        return obj.get_full_name().strip() or obj.email


class AgentCitizenDetailSerializer(AgentCitizenListSerializer):
    recent_requests = serializers.SerializerMethodField()
    contact_count = serializers.SerializerMethodField()

    class Meta(AgentCitizenListSerializer.Meta):
        fields = AgentCitizenListSerializer.Meta.fields + ("recent_requests", "contact_count")

    def get_recent_requests(self, obj):
        queryset = obj.citizen_requests.select_related("service", "assigned_to").all()[:10]
        return CitizenRequestSerializer(queryset, many=True, context=self.context).data

    def get_contact_count(self, obj):
        return obj.contact_messages.count()


class AssigneeSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "display_name", "role")

    def get_display_name(self, obj):
        return obj.get_full_name().strip() or obj.email


class AdminUserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    request_count = serializers.SerializerMethodField()
    contact_count = serializers.SerializerMethodField()
    has_password = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "email", "first_name", "last_name", "display_name", "role", "phone_number",
            "email_verified", "is_active", "is_staff", "is_superuser", "auth_provider",
            "locale", "has_password", "request_count", "contact_count", "date_joined",
            "last_login", "updated_at",
        )
        read_only_fields = (
            "id", "email", "display_name", "is_staff", "is_superuser", "auth_provider",
            "has_password", "request_count", "contact_count", "date_joined", "last_login",
            "updated_at",
        )

    def get_display_name(self, obj):
        return obj.get_full_name().strip() or obj.email

    def get_request_count(self, obj):
        annotated = getattr(obj, "request_count", None)
        return annotated if annotated is not None else obj.citizen_requests.count()

    def get_contact_count(self, obj):
        annotated = getattr(obj, "contact_count", None)
        return annotated if annotated is not None else obj.contact_messages.count()

    def get_has_password(self, obj):
        return obj.has_usable_password()


class AdminUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, min_length=8)
    email_verified = serializers.BooleanField(default=True)

    class Meta:
        model = User
        fields = (
            "id", "email", "password", "first_name", "last_name", "phone_number", "role",
            "email_verified", "is_active", "locale",
        )
        read_only_fields = ("id",)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cette adresse email.")
        return value

    def validate_password(self, value):
        password_validation.validate_password(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "first_name", "last_name", "phone_number", "role", "email_verified",
            "is_active", "locale",
        )

    def validate(self, attrs):
        request = self.context.get("request")
        instance = self.instance
        if request and instance:
            if instance.pk == request.user.pk:
                if attrs.get("role", instance.role) != User.Role.ADMIN:
                    raise serializers.ValidationError({"role": "Vous ne pouvez pas retirer votre propre rôle administrateur."})
                if attrs.get("is_active", instance.is_active) is False:
                    raise serializers.ValidationError({"is_active": "Vous ne pouvez pas désactiver votre propre compte."})
            if instance.is_superuser and not request.user.is_superuser:
                raise serializers.ValidationError("Seul un superutilisateur peut modifier un superutilisateur.")
            if instance.is_superuser and attrs.get("role", instance.role) != User.Role.ADMIN:
                raise serializers.ValidationError({"role": "Un superutilisateur doit rester administrateur."})

            next_role = attrs.get("role", instance.role)
            next_active = attrs.get("is_active", instance.is_active)
            if instance.role == User.Role.ADMIN and (next_role != User.Role.ADMIN or not next_active):
                active_admins = User.objects.filter(role=User.Role.ADMIN, is_active=True).count()
                if instance.is_active and active_admins <= 1:
                    raise serializers.ValidationError("Il doit rester au moins un administrateur actif.")
        return attrs


    def update(self, instance, validated_data):
        from django.db import transaction
        from apps.users.services.sessions import revoke_all
        with transaction.atomic():
            instance = User.objects.select_for_update().get(pk=instance.pk)
            security_change = any(field in validated_data and validated_data[field] != getattr(instance, field)
                                  for field in ('is_active', 'role', 'email_verified'))
            instance = super().update(instance, validated_data)
            if security_change:
                revoke_all(instance, 'admin_account_change')
            return instance


class StaffAuditEventSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()
    subject = serializers.SerializerMethodField()

    class Meta:
        model = StaffAuditEvent
        fields = (
            "id", "created_at", "actor", "actor_role", "action", "resource_type",
            "resource_id", "resource_reference", "subject", "summary", "changes",
            "metadata", "visibility",
        )
        read_only_fields = fields

    def _user_payload(self, user):
        if not user:
            return None
        return {
            "id": user.pk,
            "display_name": user.get_full_name().strip() or user.email,
            "email": user.email,
            "role": user.role,
        }

    def get_actor(self, obj):
        return self._user_payload(obj.actor)

    def get_subject(self, obj):
        return self._user_payload(obj.subject_user)


class WebCupRequestSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebCupRequestSnapshot
        fields = (
            "external_id", "request_code", "requester_name", "requester_type",
            "message_public", "difficulty", "difficulty_level", "xp_base",
            "xp_time_bonus", "xp_total", "xp_available", "is_ai_related",
            "arrival_type", "wave_number", "arrival_time", "group_name",
            "sort_order", "is_initial", "is_ai_request", "visible_since_wave",
            "is_visible", "first_seen_at", "last_seen_at",
        )
        read_only_fields = fields
