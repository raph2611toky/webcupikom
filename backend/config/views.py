import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)


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
