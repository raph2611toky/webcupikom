from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .assistant_serializers import OrientationRequestSerializer
from .assistant_swagger import capabilities_schema, orient_schema
from .services.orientation import orient_citizen


class AssistantAnonThrottle(AnonRateThrottle):
    rate = "30/min"


class CitizenOrientationView(APIView):
    """D10/F91/F92 — « je décris mon besoin, Nova Terra m'oriente »."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AssistantAnonThrottle]

    @orient_schema
    def post(self, request):
        serializer = OrientationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return Response(orient_citizen(
            data["message"],
            language=data.get("language", "fr"),
            max_suggestions=data.get("max_suggestions", 3),
        ))


class CitizenOrientationCapabilitiesView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @capabilities_schema
    def get(self, request):
        return Response({
            "endpoint": "/api/assistant/orient/",
            "languages": ["fr", "en"],
            "max_message_length": 600,
            "supports_typos": True,
            "uses_existing_services_only": True,
            "persists_messages": False,
            "examples": [
                "J'ai perdu mes papiers",
                "Un lampadaire est cassé dans ma rue",
                "Je cherche un médecin",
                "Il y a une fuite d'eau dans la rue",
            ],
        })
