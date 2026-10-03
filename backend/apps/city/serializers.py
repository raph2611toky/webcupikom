from django.contrib.auth import password_validation
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import serializers

from apps.users.models import User

from .models import (
    CitizenNotification,
    CitizenRequest,
    ContactMessage,
    MunicipalService,
    NewsArticle,
    WebCupRequestSnapshot,
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


class MunicipalServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = MunicipalService
        fields = (
            "id", "name", "slug", "category", "short_description", "description",
            "opening_hours", "phone", "email", "address",
        )


class AdminMunicipalServiceSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = MunicipalService
        fields = (
            "id", "name", "slug", "category", "short_description", "description",
            "opening_hours", "phone", "email", "address", "is_active", "sort_order",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        slug = attrs.get("slug")
        if slug:
            queryset = MunicipalService.objects.filter(slug=slug)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError({"slug": "Ce slug est déjà utilisé."})
        return attrs

    def create(self, validated_data):
        if not validated_data.get("slug"):
            validated_data["slug"] = _unique_slug(
                MunicipalService, validated_data.get("name", "service"), max_length=180
            )
        return super().create(validated_data)


class NewsArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsArticle
        fields = (
            "id", "title", "slug", "category", "excerpt", "content", "published_at",
        )


class AdminNewsArticleSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = NewsArticle
        fields = (
            "id", "title", "slug", "category", "excerpt", "content", "is_published",
            "published_at", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        slug = attrs.get("slug")
        if slug:
            queryset = NewsArticle.objects.filter(slug=slug)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError({"slug": "Ce slug est déjà utilisé."})
        return attrs

    def create(self, validated_data):
        if not validated_data.get("slug"):
            validated_data["slug"] = _unique_slug(
                NewsArticle, validated_data.get("title", "actualite"), max_length=240
            )
        return super().create(validated_data)


class ContactMessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ("name", "email", "service", "subject", "message")

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
        fields = ("reference", "status", "created_at")


class ContactMessageSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
    user_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = ContactMessage
        fields = (
            "id", "reference", "user", "user_name", "name", "email", "service",
            "service_name", "subject", "message", "status", "assigned_to",
            "assigned_to_name", "read_at", "closed_at", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "reference", "user", "user_name", "name", "email", "service",
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
        return obj.assigned_to.get_full_name().strip() or obj.assigned_to.email

    def validate_assigned_to(self, value):
        if value and not (
            value.is_active
            and (value.is_superuser or getattr(value, "role", None) in {"agent", "admin"})
        ):
            raise serializers.ValidationError("Le responsable doit être un agent ou administrateur actif.")
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
            "reference", "service", "service_name", "subject", "message", "status",
            "created_at", "updated_at",
        )
        read_only_fields = fields


class CitizenRequestSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
    citizen_name = serializers.SerializerMethodField()
    citizen_email = serializers.EmailField(source="citizen.email", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = CitizenRequest
        fields = (
            "id", "reference", "citizen", "citizen_name", "citizen_email",
            "service", "service_name", "title", "description", "status", "priority",
            "assigned_to", "assigned_to_name", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "reference", "citizen", "citizen_name", "citizen_email",
            "status", "assigned_to", "assigned_to_name", "created_at", "updated_at",
        )

    def get_citizen_name(self, obj):
        return obj.citizen.get_full_name().strip() or obj.citizen.email

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to:
            return None
        return obj.assigned_to.get_full_name().strip() or obj.assigned_to.email

    def validate_service(self, value):
        if value and not value.is_active:
            raise serializers.ValidationError("Ce service n'est pas disponible.")
        return value

    def create(self, validated_data):
        validated_data["citizen"] = self.context["request"].user
        return super().create(validated_data)


class AgentCitizenRequestSerializer(CitizenRequestSerializer):
    class Meta(CitizenRequestSerializer.Meta):
        read_only_fields = (
            "id", "reference", "citizen", "citizen_name", "citizen_email",
            "service", "service_name", "title", "description",
            "created_at", "updated_at", "assigned_to_name",
        )

    def validate_assigned_to(self, value):
        if value and not (
            value.is_active
            and (value.is_superuser or getattr(value, "role", None) in {"agent", "admin"})
        ):
            raise serializers.ValidationError("La demande ne peut être assignée qu'à un agent ou administrateur actif.")
        return value


class CitizenNotificationSerializer(serializers.ModelSerializer):
    request_reference = serializers.CharField(source="related_request.reference", read_only=True)
    contact_reference = serializers.CharField(source="related_contact.reference", read_only=True)

    class Meta:
        model = CitizenNotification
        fields = (
            "id", "kind", "title", "message", "request_reference", "contact_reference",
            "is_read", "read_at", "created_at",
        )
        read_only_fields = (
            "id", "kind", "title", "message", "request_reference", "contact_reference",
            "read_at", "created_at",
        )

    def update(self, instance, validated_data):
        is_read = validated_data.get("is_read", instance.is_read)
        instance.is_read = is_read
        instance.read_at = timezone.now() if is_read else None
        instance.save(update_fields=["is_read", "read_at"])
        return instance


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
