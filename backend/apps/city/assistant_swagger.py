from drf_yasg.utils import swagger_auto_schema

from .assistant_serializers import (
    OrientationCapabilitiesSerializer,
    OrientationRequestSerializer,
    OrientationResponseSerializer,
)

PUBLIC_SECURITY = []

orient_schema = swagger_auto_schema(
    tags=["Assistant citoyen - D10/F91/F92"],
    operation_id="assistant_orient",
    operation_summary="Orienter automatiquement un habitant à partir de son besoin",
    operation_description=(
        "Analyse une formulation libre, y compris avec fautes légères, puis propose uniquement "
        "un service municipal ou une catégorie de signalement réellement disponible dans Nova Terra. "
        "Une confiance faible déclenche des suggestions plutôt qu'une décision forcée."
    ),
    request_body=OrientationRequestSerializer,
    responses={200: OrientationResponseSerializer()},
    security=PUBLIC_SECURITY,
)

capabilities_schema = swagger_auto_schema(
    tags=["Assistant citoyen - D10/F91/F92"],
    operation_id="assistant_capabilities",
    operation_summary="Décrire les capacités de l'assistant d'orientation",
    responses={200: OrientationCapabilitiesSerializer()},
    security=PUBLIC_SECURITY,
)
