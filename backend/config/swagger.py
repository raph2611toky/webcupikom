"""Configuration et documentation Swagger/OpenAPI globale du projet.

Ce module n'importe aucune vue applicative. Les vues importent les décorateurs
qu'elles utilisent, ce qui évite les dépendances circulaires Swagger -> views.
"""

from django.conf import settings
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from drf_yasg.views import get_schema_view
from rest_framework.permissions import AllowAny


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
        "detail": openapi.Schema(type=openapi.TYPE_STRING, example="Une erreur interne est survenue."),
    },
)

health_get_schema = swagger_auto_schema(
    method="get",
    tags=["Système"],
    operation_id="system_health",
    operation_summary="Vérifier l'état de l'API",
    security=[],
    manual_parameters=[],
    responses={
        200: openapi.Response("API disponible", health_response_schema),
        500: openapi.Response("Erreur serveur", error_response_schema),
    },
)

schema_view = get_schema_view(
    openapi.Info(
        title="IKOM API",
        default_version="v1",
        description=(
            "Documentation sécurisée de l’API IKOM / Terra Nova : authentification, rôles, "
            "services municipaux, actualités, contact, demandes citoyennes et flux WebCup. "
            "Les endpoints protégés utilisent un JWT Bearer."
        ),
        contact=openapi.Contact(email=settings.SUPPORT_EMAIL),
    ),
    public=True,
    permission_classes=[AllowAny],
)
