"""Documentation Swagger/OpenAPI du domaine Terra Nova.

Ce module ne dépend jamais de ``views``. Les vues importent les décorateurs
ci-dessous. Les opérations d'écriture sont documentées avec des paramètres
manuels champ par champ et sans body Swagger automatique.
"""

from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import serializers

from helpers.swagger import ManualFormAutoSchema, NoBodyAutoSchema

from .serializers import (
    AdminMunicipalServiceSerializer,
    AdminNewsArticleSerializer,
    AdminUserSerializer,
    AgentAppointmentSerializer,
    AgentCitizenRequestDetailSerializer,
    AgentCitizenRequestSerializer,
    AgentRequestEventCreateSerializer,
    CitizenAppointmentSerializer,
    CitizenNotificationSerializer,
    CitizenPreferenceSerializer,
    CitizenRequestSerializer,
    SimilarCitizenRequestResponseSerializer,
    ContactMessageSerializer,
    StaffAuditEventSerializer,
)

from .report_swagger import RICH_PARAMETERS, IMAGE_PARAMETERS, ReportCreatedSerializer, responses as report_responses

PUBLIC_SECURITY = []
JWT_SECURITY = [{"Bearer": []}]


def form_string(name, description, *, required=False, fmt=None):
    return openapi.Parameter(
        name,
        openapi.IN_FORM,
        description=description,
        type=openapi.TYPE_STRING,
        format=fmt,
        required=required,
    )


def form_bool(name, description, *, required=False):
    return openapi.Parameter(
        name,
        openapi.IN_FORM,
        description=description,
        type=openapi.TYPE_BOOLEAN,
        required=required,
    )


def form_int(name, description, *, required=False):
    return openapi.Parameter(
        name,
        openapi.IN_FORM,
        description=description,
        type=openapi.TYPE_INTEGER,
        required=required,
    )


def form_number(name, description, *, required=False):
    return openapi.Parameter(
        name,
        openapi.IN_FORM,
        description=description,
        type=openapi.TYPE_NUMBER,
        required=required,
    )


def query_string(name, description):
    return openapi.Parameter(name, openapi.IN_QUERY, description=description, type=openapi.TYPE_STRING, required=False)


CONTACT_CREATE_PARAMETERS = [
    form_string("category", "Catégorie : general ou privacy (privacy exige un compte citoyen connecté)"),
    form_string("name", "Nom de l'expéditeur", required=True),
    form_string("email", "Adresse email", required=True, fmt=openapi.FORMAT_EMAIL),
    form_int("service", "ID du service municipal concerné"),
    form_string("subject", "Sujet du message", required=True),
    form_string("message", "Message", required=True),
]

PREFERENCES_PARAMETERS = [
    form_string("language", "Langue préférée : fr ou en"),
    form_bool("screen_reader_mode", "Mode lecteur d'écran"),
    form_bool("high_contrast", "Contraste renforcé"),
    form_int("font_scale", "Échelle des textes entre 80 et 180"),
    form_string("onboarding_step", "Étape d'onboarding"),
]

ONBOARDING_PARAMETERS = [
    form_string("step", "Étape d'onboarding"),
    form_bool("completed", "Marquer l'onboarding terminé"),
]

CITIZEN_REQUEST_PARAMETERS = [
    *RICH_PARAMETERS,
    form_int("service", "ID du service municipal"),
    form_string("request_type", "Type : procedure ou report"),
    form_string("incident_category", "Catégorie d'incident"),
    form_string("title", "Titre", required=True),
    form_string("description", "Description", required=True),
    form_string("location_text", "Lieu en texte libre"),
    form_number("latitude", "Latitude"),
    form_number("longitude", "Longitude"),
]

ISSUE_REPORT_PARAMETERS = [
    *RICH_PARAMETERS,
    form_int("service", "ID du service municipal"),
    form_string("incident_category", "Catégorie d'incident"),
    form_string("title", "Titre", required=True),
    form_string("description", "Description", required=True),
    form_string("location_text", "Lieu en texte libre"),
    form_number("latitude", "Latitude"),
    form_number("longitude", "Longitude"),
]

NOTIFICATION_UPDATE_PARAMETERS = [
    form_bool("is_read", "État de lecture", required=True),
]

REQUEST_AGENT_UPDATE_PARAMETERS = [
    form_int("service", "Service municipal actif ; null pour remettre en triage"),
    form_int("duplicate_of", "ID du signalement doublon, interne uniquement"),
    form_string("resolution_summary", "Résultat, motif de rejet ou informations demandées. Requis lors de completed, rejected, action_required."),
    form_string("status", "Statut de la demande"),
    form_string("priority", "Priorité de la demande"),
    form_int("assigned_to", "ID de l'agent ou administrateur responsable"),
]

REQUEST_AGENT_LIST_PARAMETERS = [
    query_string("status", "Filtrer par statut"),
    query_string("service", "ID ou slug du service municipal"),
    query_string("assigned_to", "ID de l'agent responsable"),
    query_string("priority", "low, normal, high ou urgent"),
    query_string("handling_route", "standard, priority ou emergency"),
    query_string("alert_status", "none, pending, dispatched ou acknowledged"),
    query_string("type", "procedure ou report"),
    query_string("incident_category", "Catégorie d'incident"),
    query_string("search", "Référence, titre, description, citoyen ou service"),
    openapi.Parameter(
        "duplicate", openapi.IN_QUERY, type=openapi.TYPE_BOOLEAN, required=False,
        description="true : uniquement les signalements déjà marqués comme doublons ; false : les autres.",
    ),
    openapi.Parameter(
        "awaiting_handling", openapi.IN_QUERY, type=openapi.TYPE_BOOLEAN, required=False,
        description="true : demandes envoyées/à traiter qui n'ont pas encore été prises en charge.",
    ),
    openapi.Parameter(
        "needs_action", openapi.IN_QUERY, type=openapi.TYPE_BOOLEAN, required=False,
        description="true : demandes nécessitant actuellement une action côté agent.",
    ),
    query_string(
        "workflow_state",
        "awaiting_handling, agent_processing, citizen_action_required ou closed",
    ),
    query_string("page", "Numéro de page"),
    query_string("page_size", "Taille de page, 100 maximum"),
]


class AgentRequestPageSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = AgentCitizenRequestSerializer(many=True)


REPORT_ALERT_LIST_PARAMETERS = [
    query_string("alert_status", "pending, dispatched ou acknowledged"),
    query_string("incident_category", "Type de signalement urgent"),
    query_string("district", "Quartier"),
    query_string("search", "Référence, titre, description, lieu ou service"),
    query_string("page", "Numéro de page"),
    query_string("page_size", "Taille de page, 100 maximum"),
]

agent_report_alert_list_schema = swagger_auto_schema(
    tags=["Agent - Alerting"],
    operation_id="agent_report_alert_list",
    operation_summary="File des signalements urgents (F86)",
    operation_description=(
        "Retourne uniquement les signalements du circuit emergency. L'API HTTP reste la source "
        "de vérité même si le WebSocket est indisponible."
    ),
    security=JWT_SECURITY,
    manual_parameters=REPORT_ALERT_LIST_PARAMETERS,
    responses={200: AgentRequestPageSerializer()},
)

agent_report_alert_ack_schema = swagger_auto_schema(
    tags=["Agent - Alerting"],
    operation_id="agent_report_alert_acknowledge",
    operation_summary="Prendre en charge une alerte de signalement (F86)",
    operation_description="Accusé de prise en charge persistant et idempotent.",
    security=JWT_SECURITY,
    auto_schema=NoBodyAutoSchema,
    responses={200: AgentCitizenRequestDetailSerializer()},
)

admin_report_alert_list_schema = swagger_auto_schema(
    tags=["Administration - Alerting"],
    operation_id="admin_report_alert_list",
    operation_summary="File des signalements urgents (F86)",
    security=JWT_SECURITY,
    manual_parameters=REPORT_ALERT_LIST_PARAMETERS,
    responses={200: AgentRequestPageSerializer()},
)

admin_report_alert_ack_schema = swagger_auto_schema(
    tags=["Administration - Alerting"],
    operation_id="admin_report_alert_acknowledge",
    operation_summary="Prendre en charge une alerte de signalement (F86)",
    security=JWT_SECURITY,
    auto_schema=NoBodyAutoSchema,
    responses={200: AgentCitizenRequestDetailSerializer()},
)


REQUEST_SIMILAR_PARAMETERS = [
    openapi.Parameter(
        "limit", openapi.IN_QUERY, type=openapi.TYPE_INTEGER, required=False,
        description="Nombre maximum de suggestions (1 à 20, défaut 8).",
    ),
    openapi.Parameter(
        "min_score", openapi.IN_QUERY, type=openapi.TYPE_NUMBER, required=False,
        description="Seuil minimal de similarité entre 0.20 et 0.95 (défaut 0.42).",
    ),
]

agent_request_similar_schema = swagger_auto_schema(
    tags=["Agent - Demandes"],
    operation_id="agent_request_similar",
    operation_summary="Détecter les signalements similaires (F75)",
    operation_description=(
        "Retourne des suggestions explicables (texte, catégorie, service, quartier, proximité). "
        "Aucun doublon n'est créé automatiquement : l'agent confirme ensuite via PATCH duplicate_of."
    ),
    security=JWT_SECURITY,
    manual_parameters=REQUEST_SIMILAR_PARAMETERS,
    responses={200: SimilarCitizenRequestResponseSerializer()},
)

admin_request_similar_schema = swagger_auto_schema(
    tags=["Administration - Demandes"],
    operation_id="admin_request_similar",
    operation_summary="Détecter les signalements similaires (F75)",
    operation_description=(
        "Même détection que l'espace agent. Le marquage comme doublon reste une décision humaine via PATCH duplicate_of."
    ),
    security=JWT_SECURITY,
    manual_parameters=REQUEST_SIMILAR_PARAMETERS,
    responses={200: SimilarCitizenRequestResponseSerializer()},
)


REQUEST_EVENT_PARAMETERS = [
    *IMAGE_PARAMETERS,
    form_string("title", "Titre de l'étape", required=True),
    form_string("message", "Message"),
    form_bool("is_public", "Visible par le citoyen"),
]

CONTACT_UPDATE_PARAMETERS = [
    form_string("status", "Statut du message : received, read ou closed"),
    form_int("assigned_to", "ID de l'agent ou administrateur responsable"),
]

ADMIN_USER_CREATE_PARAMETERS = [
    form_string("email", "Adresse email", required=True, fmt=openapi.FORMAT_EMAIL),
    form_string("password", "Mot de passe", required=True),
    form_string("first_name", "Prénom"),
    form_string("last_name", "Nom"),
    form_string("phone_number", "Téléphone"),
    form_string("role", "Rôle : citizen, agent ou admin"),
    form_bool("email_verified", "Adresse email déjà vérifiée"),
    form_bool("is_active", "Compte actif"),
    form_string("locale", "Langue/locale"),
]

ADMIN_USER_UPDATE_PARAMETERS = [
    form_string("first_name", "Prénom"),
    form_string("last_name", "Nom"),
    form_string("phone_number", "Téléphone"),
    form_string("role", "Rôle : citizen, agent ou admin"),
    form_bool("email_verified", "Adresse email vérifiée"),
    form_bool("is_active", "Compte actif"),
    form_string("locale", "Langue/locale"),
]

ADMIN_SERVICE_PARAMETERS = [
    form_string("name", "Nom du service", required=True),
    form_string("slug", "Slug, généré automatiquement si vide"),
    form_string("category", "Catégorie"),
    form_string("short_description", "Description courte", required=True),
    form_string("description", "Description complète"),
    form_string("opening_hours", "Horaires"),
    form_string("phone", "Téléphone"),
    form_string("email", "Email", fmt=openapi.FORMAT_EMAIL),
    form_string("address", "Adresse"),
    form_string("actions", "Tableau JSON des actions proposées"),
    form_string("required_documents", "Tableau JSON des documents nécessaires"),
    form_string("faq", "Tableau JSON de FAQ"),
    form_string("translations", "Objet JSON de traductions"),
    form_bool("is_featured", "Mettre en avant le service"),
    form_int("priority_order", "Ordre de priorité"),
    form_bool("is_active", "Service actif"),
    form_int("sort_order", "Ordre d'affichage"),
]


SERVICE_AVAILABILITY_PARAMETERS = [
    form_bool("is_available", "true pour remettre le service en ligne, false pour le rendre indisponible", required=True),
    form_string("reason", "Motif citoyen de l'indisponibilité"),
    form_string("alternative_action", "Prochaine action proposée au citoyen"),
    form_string("expected_restore_at", "Date/heure ISO 8601 estimée de rétablissement"),
]

ADMIN_NEWS_PARAMETERS = [
    form_string("title", "Titre", required=True),
    form_string("slug", "Slug, généré automatiquement si vide"),
    form_string("category", "Catégorie"),
    form_string("excerpt", "Résumé"),
    form_string("content", "Contenu complet", required=True),
    form_bool("is_published", "Publication visible"),
    form_string("published_at", "Date/heure ISO 8601"),
]

APPOINTMENT_CREATE_PARAMETERS = [
    form_int("agent", "ID de l'agent municipal", required=True),
    form_int("service", "ID du service municipal concerné"),
    form_string("starts_at", "Début du rendez-vous au format ISO 8601", required=True),
    form_string("ends_at", "Fin du rendez-vous au format ISO 8601", required=True),
    form_string("reason", "Motif du rendez-vous", required=True),
    form_string("details", "Informations complémentaires"),
    form_bool("reminder_enabled", "Activer le rappel avant le rendez-vous"),
    form_int("reminder_minutes_before", "Nombre de minutes avant le rendez-vous pour afficher le rappel"),
]

APPOINTMENT_CITIZEN_UPDATE_PARAMETERS = [
    form_string("status", "Utiliser cancelled pour annuler le rendez-vous"),
    form_bool("reminder_enabled", "Activer ou désactiver le rappel"),
    form_int("reminder_minutes_before", "Nombre de minutes avant le rendez-vous pour le rappel"),
]

APPOINTMENT_AGENT_UPDATE_PARAMETERS = [
    form_string("status", "Statut : requested, confirmed, declined, cancelled ou completed"),
    form_string("starts_at", "Nouveau début au format ISO 8601"),
    form_string("ends_at", "Nouvelle fin au format ISO 8601"),
    form_string("location", "Lieu précis du rendez-vous"),
    form_string("preparation_instructions", "Instructions pour préparer le rendez-vous"),
]

APPOINTMENT_AGENT_LIST_PARAMETERS = [
    query_string("status", "Filtrer par statut du rendez-vous"),
    query_string("citizen", "ID du citoyen"),
    query_string("agent", "ID de l'agent (administrateur uniquement)"),
    openapi.Parameter("upcoming", openapi.IN_QUERY, type=openapi.TYPE_BOOLEAN, required=False, description="Afficher uniquement les rendez-vous actifs à venir"),
    query_string("date_from", "Date minimale YYYY-MM-DD"),
    query_string("date_to", "Date maximale YYYY-MM-DD"),
    query_string("search", "Référence, motif, citoyen ou service"),
]

AUDIT_LIST_PARAMETERS = [
    query_string("actor", "ID de l'agent ou administrateur auteur"),
    query_string("action", "Action exacte, par exemple request.update ou appointment.update"),
    query_string("resource_type", "Type de ressource : request, appointment, citizen, service, publication..."),
    query_string("resource_id", "Identifiant de la ressource"),
    query_string("date_from", "Date minimale YYYY-MM-DD"),
    query_string("date_to", "Date maximale YYYY-MM-DD"),
    openapi.Parameter("mine", openapi.IN_QUERY, type=openapi.TYPE_BOOLEAN, required=False, description="Afficher uniquement mes propres actions"),
    query_string("search", "Résumé, référence de ressource ou identité de l'auteur"),
    query_string("page", "Numéro de page"),
    query_string("page_size", "Taille de page, 100 maximum"),
]


class StaffAuditPageSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = StaffAuditEventSerializer(many=True)


NOTIFICATION_SEND_PARAMETERS = [
    form_string("audience", "Audience : global ou targeted", required=True),
    form_int("recipient", "ID du citoyen pour une notification ciblée"),
    form_string("title", "Titre de la notification", required=True),
    form_string("message", "Message de la notification"),
    form_string("action_label", "Libellé du bouton d'action"),
    form_string("action_url", "URL ou route frontend de l'action"),
    form_string("visible_from", "Date/heure ISO 8601 à partir de laquelle la notification devient visible"),
    form_bool("is_important", "Notification importante : envoie également un email au citoyen"),
]


contact_create_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Ville - Contact"],
    operation_id="city_contact_create",
    operation_summary="Envoyer un message à la mairie",
    security=PUBLIC_SECURITY,
    manual_parameters=CONTACT_CREATE_PARAMETERS,
    responses={201: "Message enregistré"},
)

citizen_preferences_patch_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Citoyen"],
    operation_id="citizen_preferences_update",
    operation_summary="Modifier les préférences citoyennes",
    security=JWT_SECURITY,
    manual_parameters=PREFERENCES_PARAMETERS,
    responses={200: CitizenPreferenceSerializer()},
)

citizen_onboarding_patch_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Citoyen"],
    operation_id="citizen_onboarding_update",
    operation_summary="Mettre à jour l'onboarding",
    security=JWT_SECURITY,
    manual_parameters=ONBOARDING_PARAMETERS,
    responses={200: "État d'onboarding"},
)

citizen_request_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Citoyen - Demandes"],
    operation_id="citizen_request_create",
    operation_summary="Créer une demande citoyenne",
    security=JWT_SECURITY,
    manual_parameters=CITIZEN_REQUEST_PARAMETERS,
    responses=report_responses(ReportCreatedSerializer,201),
)

citizen_report_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Citoyen - Demandes"],
    operation_id="citizen_report_create",
    operation_summary="Créer un signalement",
    security=JWT_SECURITY,
    manual_parameters=ISSUE_REPORT_PARAMETERS,
    responses=report_responses(ReportCreatedSerializer,201),
)

citizen_notification_patch_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Citoyen - Notifications"],
    operation_id="citizen_notification_update",
    operation_summary="Modifier l'état de lecture d'une notification",
    security=JWT_SECURITY,
    manual_parameters=NOTIFICATION_UPDATE_PARAMETERS,
    responses={200: CitizenNotificationSerializer()},
)

citizen_notification_read_all_schema = swagger_auto_schema(
    auto_schema=NoBodyAutoSchema,
    tags=["Citoyen - Notifications"],
    operation_id="citizen_notification_read_all",
    operation_summary="Marquer toutes les notifications comme lues",
    security=JWT_SECURITY,
    manual_parameters=[],
    responses={200: "Nombre de notifications mises à jour"},
)

citizen_appointment_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Citoyen - Rendez-vous"],
    operation_id="citizen_appointment_create",
    operation_summary="Prendre rendez-vous avec un agent",
    security=JWT_SECURITY,
    manual_parameters=APPOINTMENT_CREATE_PARAMETERS,
    responses={201: CitizenAppointmentSerializer()},
)

citizen_appointment_patch_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Citoyen - Rendez-vous"],
    operation_id="citizen_appointment_update",
    operation_summary="Annuler un rendez-vous ou modifier son rappel",
    security=JWT_SECURITY,
    manual_parameters=APPOINTMENT_CITIZEN_UPDATE_PARAMETERS,
    responses={200: CitizenAppointmentSerializer()},
)

agent_notification_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Agent - Notifications"],
    operation_id="agent_notification_create",
    operation_summary="Envoyer une notification ciblée à un citoyen",
    operation_description="Les agents peuvent uniquement utiliser audience=targeted.",
    security=JWT_SECURITY,
    manual_parameters=NOTIFICATION_SEND_PARAMETERS,
    responses={201: "Notification envoyée"},
)

agent_appointment_list_schema = swagger_auto_schema(
    tags=["Agent - Rendez-vous"],
    operation_id="agent_appointment_list",
    operation_summary="Lister et filtrer les rendez-vous à traiter",
    security=JWT_SECURITY,
    manual_parameters=APPOINTMENT_AGENT_LIST_PARAMETERS,
    responses={200: AgentAppointmentSerializer(many=True)},
)

admin_appointment_list_schema = swagger_auto_schema(
    tags=["Administration - Rendez-vous"],
    operation_id="admin_appointment_list",
    operation_summary="Lister et filtrer tous les rendez-vous",
    security=JWT_SECURITY,
    manual_parameters=APPOINTMENT_AGENT_LIST_PARAMETERS,
    responses={200: AgentAppointmentSerializer(many=True)},
)

agent_audit_list_schema = swagger_auto_schema(
    tags=["Agent - Audit"],
    operation_id="agent_audit_list",
    operation_summary="Consulter le journal des actions agents",
    security=JWT_SECURITY,
    manual_parameters=AUDIT_LIST_PARAMETERS,
    responses={200: StaffAuditPageSerializer()},
)

admin_audit_list_schema = swagger_auto_schema(
    tags=["Administration - Audit"],
    operation_id="admin_audit_list",
    operation_summary="Consulter le journal complet des actions staff",
    security=JWT_SECURITY,
    manual_parameters=AUDIT_LIST_PARAMETERS,
    responses={200: StaffAuditPageSerializer()},
)

agent_appointment_patch_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Agent - Rendez-vous"],
    operation_id="agent_appointment_update",
    operation_summary="Confirmer, replanifier ou clôturer un rendez-vous",
    security=JWT_SECURITY,
    manual_parameters=APPOINTMENT_AGENT_UPDATE_PARAMETERS,
    responses={200: AgentAppointmentSerializer()},
)

agent_request_list_schema = swagger_auto_schema(
    tags=["Agent - Demandes"],
    operation_summary="Lister et filtrer la file de demandes citoyennes",
    security=JWT_SECURITY,
    manual_parameters=REQUEST_AGENT_LIST_PARAMETERS,
    responses={200: AgentRequestPageSerializer()},
)

agent_request_patch_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Agent - Demandes"],
    operation_id="agent_request_update",
    operation_summary="Traiter une demande citoyenne",
    security=JWT_SECURITY,
    manual_parameters=REQUEST_AGENT_UPDATE_PARAMETERS,
    responses={200: AgentCitizenRequestDetailSerializer()},
)

agent_request_event_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Agent - Demandes"],
    operation_id="agent_request_timeline_create",
    operation_summary="Ajouter une étape à l'historique d'une demande",
    security=JWT_SECURITY,
    manual_parameters=REQUEST_EVENT_PARAMETERS,
    responses={201: AgentRequestEventCreateSerializer()},
)

agent_contact_patch_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Agent - Contact"],
    operation_id="agent_contact_update",
    operation_summary="Traiter un message de contact",
    security=JWT_SECURITY,
    manual_parameters=CONTACT_UPDATE_PARAMETERS,
    responses={200: ContactMessageSerializer()},
)

admin_user_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Administration - Utilisateurs"],
    operation_id="admin_user_create",
    operation_summary="Créer un utilisateur",
    security=JWT_SECURITY,
    manual_parameters=ADMIN_USER_CREATE_PARAMETERS,
    responses={201: AdminUserSerializer()},
)

admin_user_patch_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Administration - Utilisateurs"],
    operation_id="admin_user_update",
    operation_summary="Modifier un utilisateur",
    security=JWT_SECURITY,
    manual_parameters=ADMIN_USER_UPDATE_PARAMETERS,
    responses={200: AdminUserSerializer()},
)

admin_service_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Administration - Services"],
    operation_id="admin_service_create",
    operation_summary="Créer un service municipal",
    security=JWT_SECURITY,
    manual_parameters=ADMIN_SERVICE_PARAMETERS,
    responses={201: AdminMunicipalServiceSerializer()},
)

admin_service_patch_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Administration - Services"],
    operation_id="admin_service_update",
    operation_summary="Modifier un service municipal",
    security=JWT_SECURITY,
    manual_parameters=ADMIN_SERVICE_PARAMETERS,
    responses={200: AdminMunicipalServiceSerializer()},
)


service_availability_patch_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Services - Disponibilité"],
    operation_summary="Rendre un service disponible ou indisponible",
    operation_description=(
        "Accessible aux agents responsables et aux administrateurs. "
        "Le service n'est jamais supprimé : son état, le motif, le retour estimé "
        "et la prochaine action sont exposés aux citoyens."
    ),
    security=JWT_SECURITY,
    manual_parameters=SERVICE_AVAILABILITY_PARAMETERS,
    responses={200: AdminMunicipalServiceSerializer()},
)

admin_service_delete_schema = swagger_auto_schema(
    auto_schema=NoBodyAutoSchema,
    tags=["Administration - Services"],
    operation_id="admin_service_disable",
    operation_summary="Désactiver un service municipal",
    security=JWT_SECURITY,
    manual_parameters=[],
    responses={204: "Service désactivé"},
)

admin_news_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Administration - Actualités"],
    operation_id="admin_news_create",
    operation_summary="Créer une actualité",
    security=JWT_SECURITY,
    manual_parameters=ADMIN_NEWS_PARAMETERS,
    responses={201: AdminNewsArticleSerializer()},
)

admin_news_patch_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Administration - Actualités"],
    operation_id="admin_news_update",
    operation_summary="Modifier une actualité",
    security=JWT_SECURITY,
    manual_parameters=ADMIN_NEWS_PARAMETERS,
    responses={200: AdminNewsArticleSerializer()},
)

admin_news_delete_schema = swagger_auto_schema(
    auto_schema=NoBodyAutoSchema,
    tags=["Administration - Actualités"],
    operation_id="admin_news_unpublish",
    operation_summary="Dépublier une actualité",
    security=JWT_SECURITY,
    manual_parameters=[],
    responses={204: "Actualité dépubliée"},
)

admin_notification_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Administration - Notifications"],
    operation_id="admin_notification_create",
    operation_summary="Envoyer une notification globale ou ciblée",
    security=JWT_SECURITY,
    manual_parameters=NOTIFICATION_SEND_PARAMETERS,
    responses={201: "Notification envoyée"},
)

admin_appointment_patch_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Administration - Rendez-vous"],
    operation_id="admin_appointment_update",
    operation_summary="Modifier un rendez-vous citoyen",
    security=JWT_SECURITY,
    manual_parameters=APPOINTMENT_AGENT_UPDATE_PARAMETERS,
    responses={200: AgentAppointmentSerializer()},
)

admin_contact_patch_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Administration - Contact"],
    operation_id="admin_contact_update",
    operation_summary="Traiter un message de contact",
    security=JWT_SECURITY,
    manual_parameters=CONTACT_UPDATE_PARAMETERS,
    responses={200: ContactMessageSerializer()},
)

admin_request_list_schema = swagger_auto_schema(
    tags=["Administration - Demandes"],
    operation_summary="Lister et filtrer la file de demandes citoyennes",
    security=JWT_SECURITY,
    manual_parameters=REQUEST_AGENT_LIST_PARAMETERS,
    responses={200: AgentRequestPageSerializer()},
)

admin_request_patch_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Administration - Demandes"],
    operation_id="admin_request_update",
    operation_summary="Traiter une demande citoyenne",
    security=JWT_SECURITY,
    manual_parameters=REQUEST_AGENT_UPDATE_PARAMETERS,
    responses={200: AgentCitizenRequestDetailSerializer()},
)

admin_request_event_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Administration - Demandes"],
    operation_id="admin_request_timeline_create",
    operation_summary="Ajouter une étape à l'historique d'une demande",
    security=JWT_SECURITY,
    manual_parameters=REQUEST_EVENT_PARAMETERS,
    responses={201: AgentRequestEventCreateSerializer()},
)
