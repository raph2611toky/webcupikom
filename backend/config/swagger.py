"""Configuration et documentation Swagger/OpenAPI globale du projet."""

from django.conf import settings
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from drf_yasg.views import get_schema_view
from rest_framework.permissions import AllowAny

from .views import health as health_view


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
        "detail": openapi.Schema(
            type=openapi.TYPE_STRING,
            example="Une erreur interne est survenue.",
        ),
    },
)


health = swagger_auto_schema(
    method="get",
    tags=["Système"],
    operation_id="system_health",
    operation_summary="Vérifier l'état de l'API",
    security=[],
    responses={
        200: openapi.Response("API disponible", health_response_schema),
        500: openapi.Response("Erreur serveur", error_response_schema),
    },
)(health_view)


schema_view = get_schema_view(
    openapi.Info(
        title="IKOM API",
        default_version="v1",
        description=(
            "Documentation sécurisée de l’API IKOM : authentification locale/Google, "
            "gestion de compte et profil. Les endpoints protégés utilisent un JWT Bearer."
        ),
        contact=openapi.Contact(email=settings.SUPPORT_EMAIL),
    ),
    public=True,
    permission_classes=[AllowAny],
)
