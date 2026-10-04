from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema

from .engagement_serializers import (
    AdminPrivacyConcernSerializer,
    AdminServiceFeedbackSerializer,
    CitizenPrivacyConcernSerializer,
    CitizenRequestSupportStateSerializer,
    ServiceFeedbackSerializer,
    ServiceFeedbackStateSerializer,
    SupportableCitizenRequestSerializer,
)

JWT_SECURITY = [{"Bearer": []}]

supportable_request_list_schema = swagger_auto_schema(
    tags=["Demandes - Soutien F52"],
    operation_id="citizen_supportable_requests_list",
    operation_summary="Lister les signalements pouvant être soutenus",
    operation_description="Projection minimisée : aucune identité, adresse précise, GPS, pièce jointe ou historique du déposant n'est exposé.",
    manual_parameters=[
        openapi.Parameter("district", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=False),
        openapi.Parameter("category", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=False),
        openapi.Parameter("service", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=False),
        openapi.Parameter("search", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=False),
    ],
    responses={200: SupportableCitizenRequestSerializer(many=True)},
    security=JWT_SECURITY,
)

request_support_get_schema = swagger_auto_schema(
    tags=["Demandes - Soutien F52"],
    operation_id="citizen_request_support_state",
    operation_summary="État de mon soutien à une demande",
    responses={200: CitizenRequestSupportStateSerializer()},
    security=JWT_SECURITY,
)

request_support_post_schema = swagger_auto_schema(
    tags=["Demandes - Soutien F52"],
    operation_id="citizen_request_support_create",
    operation_summary="Soutenir la demande d'un autre citoyen",
    request_body=None,
    responses={200: CitizenRequestSupportStateSerializer(), 201: CitizenRequestSupportStateSerializer()},
    security=JWT_SECURITY,
)

request_support_delete_schema = swagger_auto_schema(
    tags=["Demandes - Soutien F52"],
    operation_id="citizen_request_support_delete",
    operation_summary="Retirer mon soutien",
    responses={200: CitizenRequestSupportStateSerializer()},
    security=JWT_SECURITY,
)

service_feedback_get_schema = swagger_auto_schema(
    tags=["Services - Avis F76"],
    operation_id="citizen_service_feedback_state",
    operation_summary="Vérifier mon éligibilité et consulter mon avis",
    responses={200: ServiceFeedbackStateSerializer()},
    security=JWT_SECURITY,
)

service_feedback_post_schema = swagger_auto_schema(
    tags=["Services - Avis F76"],
    operation_id="citizen_service_feedback_create",
    operation_summary="Laisser un avis après utilisation vérifiée d'un service",
    request_body=ServiceFeedbackSerializer,
    responses={201: ServiceFeedbackSerializer()},
    security=JWT_SECURITY,
)

service_feedback_patch_schema = swagger_auto_schema(
    tags=["Services - Avis F76"],
    operation_id="citizen_service_feedback_update",
    operation_summary="Modifier mon avis sur un service",
    request_body=ServiceFeedbackSerializer,
    responses={200: ServiceFeedbackSerializer()},
    security=JWT_SECURITY,
)

admin_service_feedback_list_schema = swagger_auto_schema(
    tags=["Administration - Avis services"],
    operation_id="admin_service_feedback_list",
    operation_summary="Lister les avis vérifiés sur les services",
    manual_parameters=[
        openapi.Parameter("service", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=False),
        openapi.Parameter("rating", openapi.IN_QUERY, type=openapi.TYPE_INTEGER, required=False),
        openapi.Parameter("search", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=False),
    ],
    responses={200: AdminServiceFeedbackSerializer(many=True)},
    security=JWT_SECURITY,
)

privacy_concern_list_schema = swagger_auto_schema(
    tags=["Vie privée - F51"],
    operation_id="citizen_privacy_concern_list",
    operation_summary="Lister mes préoccupations vie privée",
    responses={200: CitizenPrivacyConcernSerializer(many=True)},
    security=JWT_SECURITY,
)

privacy_concern_create_schema = swagger_auto_schema(
    tags=["Vie privée - F51"],
    operation_id="citizen_privacy_concern_create",
    operation_summary="Faire remonter une préoccupation sur mes données personnelles",
    request_body=CitizenPrivacyConcernSerializer,
    responses={201: CitizenPrivacyConcernSerializer()},
    security=JWT_SECURITY,
)

privacy_concern_detail_schema = swagger_auto_schema(
    tags=["Vie privée - F51"],
    operation_id="citizen_privacy_concern_detail",
    operation_summary="Consulter le suivi d'une préoccupation vie privée",
    responses={200: CitizenPrivacyConcernSerializer()},
    security=JWT_SECURITY,
)

admin_privacy_concern_list_schema = swagger_auto_schema(
    tags=["Administration - Vie privée"],
    operation_id="admin_privacy_concern_list",
    operation_summary="Lister les préoccupations vie privée (administrateurs uniquement)",
    manual_parameters=[
        openapi.Parameter("status", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=False),
        openapi.Parameter("topic", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=False),
        openapi.Parameter("search", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=False),
    ],
    responses={200: AdminPrivacyConcernSerializer(many=True)},
    security=JWT_SECURITY,
)

admin_privacy_concern_detail_schema = swagger_auto_schema(
    tags=["Administration - Vie privée"],
    operation_id="admin_privacy_concern_detail",
    operation_summary="Consulter une préoccupation vie privée",
    responses={200: AdminPrivacyConcernSerializer()},
    security=JWT_SECURITY,
)

admin_privacy_concern_patch_schema = swagger_auto_schema(
    tags=["Administration - Vie privée"],
    operation_id="admin_privacy_concern_update",
    operation_summary="Traiter une préoccupation vie privée",
    request_body=AdminPrivacyConcernSerializer,
    responses={200: AdminPrivacyConcernSerializer()},
    security=JWT_SECURITY,
)
