from rest_framework import serializers

from .constants import SUPPORTED_LANGUAGE_CODES


class OrientationRequestSerializer(serializers.Serializer):
    message = serializers.CharField(min_length=3, max_length=600, trim_whitespace=True)
    language = serializers.ChoiceField(
        choices=sorted(SUPPORTED_LANGUAGE_CODES),
        required=False,
        default="fr",
    )
    max_suggestions = serializers.IntegerField(required=False, default=3, min_value=1, max_value=5)


class OrientationServiceSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    slug = serializers.CharField()
    name = serializers.CharField()
    category = serializers.CharField(allow_blank=True)
    short_description = serializers.CharField(allow_blank=True)
    is_available = serializers.BooleanField()
    availability_status = serializers.CharField()
    next_action = serializers.CharField(allow_blank=True)
    actions = serializers.ListField(child=serializers.CharField(), required=False)


class OrientationSuggestionSerializer(serializers.Serializer):
    intent = serializers.CharField()
    type = serializers.ChoiceField(choices=("service", "report"))
    category = serializers.CharField(allow_null=True, required=False)
    recommended_service = OrientationServiceSerializer(allow_null=True)
    action = serializers.CharField()
    route = serializers.CharField(allow_null=True)
    confidence = serializers.FloatField(min_value=0.0, max_value=1.0)
    explanation = serializers.CharField()
    emergency = serializers.BooleanField()


class OrientationResponseSerializer(serializers.Serializer):
    intent = serializers.CharField()
    type = serializers.ChoiceField(choices=("service", "report", "suggestions"))
    category = serializers.CharField(allow_null=True, required=False)
    recommended_service = OrientationServiceSerializer(allow_null=True)
    action = serializers.CharField()
    route = serializers.CharField(allow_null=True)
    confidence = serializers.FloatField(min_value=0.0, max_value=1.0)
    needs_confirmation = serializers.BooleanField()
    explanation = serializers.CharField()
    emergency = serializers.BooleanField()
    suggestions = OrientationSuggestionSerializer(many=True)
    language = serializers.ChoiceField(choices=("fr", "en"))
    engine = serializers.CharField()


class OrientationCapabilitiesSerializer(serializers.Serializer):
    endpoint = serializers.CharField()
    languages = serializers.ListField(child=serializers.CharField())
    max_message_length = serializers.IntegerField()
    supports_typos = serializers.BooleanField()
    uses_existing_services_only = serializers.BooleanField()
    persists_messages = serializers.BooleanField()
    examples = serializers.ListField(child=serializers.CharField())
