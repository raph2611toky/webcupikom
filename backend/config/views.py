import logging

from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)

health_response_schema = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    required=["status", "service"],
    properties={
        "status": openapi.Schema(type=openapi.TYPE_STRING, example="ok"),
        "service": openapi.Schema(type=openapi.TYPE_STRING, example="webcup-backend"),
    },
)

error_response_schema = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    required=["detail"],
    properties={
        "detail": openapi.Schema(type=openapi.TYPE_STRING),
    },
)


@swagger_auto_schema(
    method="get",
    tags=["Système"],
    operation_id="system_health",
    operation_summary="Vérifier l'état de l'API",
    security=[],
    responses={
        200: openapi.Response("API disponible", health_response_schema),
        500: openapi.Response("Erreur serveur", error_response_schema),
    },
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    try:
        return Response({
            "status": "ok",
            "service": "webcup-backend",
        }, status=status.HTTP_200_OK)
    except Exception as exc:
        logger.exception("Erreur non gérée dans health", exc_info=exc)
        return Response(
            {"detail": "Une erreur interne est survenue."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
