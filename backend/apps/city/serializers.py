from rest_framework import serializers

from .models import ContactMessage, CitizenRequest, MunicipalService, NewsArticle


class MunicipalServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = MunicipalService
        fields = (
            "id", "name", "slug", "category", "short_description", "description",
            "opening_hours", "phone", "email", "address",
        )


class NewsArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsArticle
        fields = (
            "id", "title", "slug", "category", "excerpt", "content", "published_at",
        )


class ContactMessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ("name", "email", "service", "subject", "message")

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["user"] = request.user
        return super().create(validated_data)


class ContactMessageReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ("reference", "status", "created_at")


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
        if value and not (value.is_superuser or getattr(value, "role", None) in {"agent", "admin"}):
            raise serializers.ValidationError("La demande ne peut être assignée qu'à un agent ou administrateur.")
        return value
