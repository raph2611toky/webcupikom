"""Documentation Swagger/OpenAPI des endpoints utilisateurs.

Règle d'architecture : ce module ne dépend jamais de ``views``.
Il expose uniquement des décorateurs ``swagger_auto_schema`` que ``views.py``
importe et applique directement sur ses méthodes HTTP.

Toutes les entrées sont décrites avec ``manual_parameters``. Aucun endpoint
n'utilise ``request_body`` dans Swagger afin de conserver un affichage champ
par champ dans l'interface de documentation.
"""

from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import serializers

from helpers.swagger import ManualFormAutoSchema, NoBodyAutoSchema

from .serializers import UserSerializer

PUBLIC_SECURITY = []
JWT_SECURITY = [{"Bearer": []}]


class MessageResponseSerializer(serializers.Serializer):
    message = serializers.CharField()


class ApiErrorResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    errors = serializers.JSONField(required=False)


class RegisterResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    registration_token = serializers.CharField(required=False)
    next_step = serializers.CharField(required=False)
    profile_endpoint = serializers.CharField(required=False)
    user = UserSerializer()


class RegistrationProfileResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    profile_completed = serializers.BooleanField()
    next_step = serializers.CharField()
    user = UserSerializer()


class AuthResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    user = UserSerializer()


class VerifyEmailResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    access = serializers.CharField()
    user = UserSerializer()


class GoogleAuthResponseSerializer(serializers.Serializer):
    created = serializers.BooleanField()
    access = serializers.CharField()
    user = UserSerializer()


class GoogleRedirectResponseSerializer(serializers.Serializer):
    authorization_url = serializers.URLField()
    redirect_uri = serializers.URLField()
    state = serializers.CharField()


class RefreshResponseSerializer(serializers.Serializer):
    access = serializers.CharField()


class ChangeEmailConfirmResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    email = serializers.EmailField()


ERROR_RESPONSE = ApiErrorResponseSerializer()


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


REGISTER_PARAMETERS = [
    form_string("email", "Adresse email", required=True, fmt=openapi.FORMAT_EMAIL),
    form_string("password", "Mot de passe (8 caractères minimum)", required=True),
    form_string("password_confirm", "Confirmation facultative du mot de passe"),
    form_string("first_name", "Prénom", required=True),
    form_string("last_name", "Nom", required=True),
]

REGISTRATION_PROFILE_PARAMETERS = [
    form_string("registration_token", "Token retourné par POST /api/auth/register/", required=True),
    form_string("first_name", "Prénom", required=True),
    form_string("last_name", "Nom", required=True),
    form_string("profession", "Profession", required=True),
    form_string("gender", "Sexe / genre : female, male, other, prefer_not_to_say", required=True),
    form_string("birth_date", "Date de naissance (AAAA-MM-JJ)"),
    form_string("phone_number", "Téléphone", required=True),
    form_string("address", "Adresse", required=True),
    form_string("habitat", "Habitat / type de logement", required=True),
    form_string("district", "Quartier / district", required=True),
    form_string("sector", "Secteur"),
    form_string("street", "Rue"),
    form_string("building", "Bâtiment"),
    form_string("apartment", "Appartement"),
]

VERIFY_EMAIL_PARAMETERS = [
    form_string("uid", "Identifiant encodé de l'utilisateur", required=True),
    form_string("token", "Token de vérification email", required=True),
]

EMAIL_PARAMETER = [
    form_string("email", "Adresse email", required=True, fmt=openapi.FORMAT_EMAIL),
]

LOGIN_PARAMETERS = [
    form_string("email", "Adresse email", required=True, fmt=openapi.FORMAT_EMAIL),
    form_string("password", "Mot de passe", required=True),
    form_bool("remember", "Conserver la session via le cookie refresh", required=False),
]

GOOGLE_LOGIN_PARAMETERS = [
    form_string("credential", "ID token Google Identity Services", required=False),
    form_string("code", "Code OAuth Google", required=False),
    form_string("state", "State signé retourné par Google", required=False),
    form_bool("remember", "Conserver la session via le cookie refresh", required=False),
]

PASSWORD_RESET_CONFIRM_PARAMETERS = [
    form_string("uid", "Identifiant encodé de l'utilisateur", required=True),
    form_string("token", "Token de réinitialisation", required=True),
    form_string("new_password", "Nouveau mot de passe", required=True),
    form_string("new_password_confirm", "Confirmation du nouveau mot de passe", required=True),
]

PROFILE_PARAMETERS = [
    form_string("first_name", "Prénom"),
    form_string("last_name", "Nom"),
    form_string("phone_number", "Numéro de téléphone"),
    form_string("profession", "Profession"),
    form_string("gender", "Sexe / genre : female, male, other, prefer_not_to_say"),
    form_string("birth_date", "Date de naissance (AAAA-MM-JJ)"),
    form_string("address", "Adresse"),
    form_string("habitat", "Habitat / type de logement"),
    form_string("district", "Quartier / district"),
    form_string("sector", "Secteur"),
    form_string("street", "Rue"),
    form_string("building", "Bâtiment"),
    form_string("apartment", "Appartement"),
    openapi.Parameter(
        "avatar",
        openapi.IN_FORM,
        description="Photo de profil",
        type=openapi.TYPE_FILE,
        required=False,
    ),
    form_string("locale", "Locale utilisateur, par exemple fr ou en"),
]

GOOGLE_REAUTH_PARAMETERS = [
    form_string("credential", "ID token Google Identity Services pour confirmer l'identité", required=False),
    form_string("code", "Code OAuth Google obtenu après GET /api/auth/google/redirect/", required=False),
    form_string("state", "State signé associé au code OAuth Google", required=False),
]

CHANGE_PASSWORD_PARAMETERS = [
    form_string("current_password", "Mot de passe actuel (compte local/hybride)", required=False),
    *GOOGLE_REAUTH_PARAMETERS,
    form_string("new_password", "Nouveau mot de passe", required=True),
    form_string("new_password_confirm", "Confirmation du nouveau mot de passe", required=True),
]

SET_PASSWORD_PARAMETERS = [
    *GOOGLE_REAUTH_PARAMETERS,
    form_string("new_password", "Nouveau mot de passe", required=True),
    form_string("new_password_confirm", "Confirmation du nouveau mot de passe", required=True),
]

CHANGE_EMAIL_PARAMETERS = [
    form_string("new_email", "Nouvelle adresse email", required=True, fmt=openapi.FORMAT_EMAIL),
    form_string("current_password", "Mot de passe actuel si le compte en possède un", required=False),
]

CHANGE_EMAIL_CONFIRM_PARAMETERS = [
    form_string("token", "Token signé de confirmation du changement d'email", required=True),
]

DELETE_ACCOUNT_PARAMETERS = [
    form_string("current_password", "Mot de passe actuel (compte local/hybride)", required=False),
    *GOOGLE_REAUTH_PARAMETERS,
    form_string("confirmation", 'Saisir exactement "DELETE"', required=True),
]


register_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Authentification"],
    operation_id="auth_register",
    operation_summary="Créer un compte citoyen",
    operation_description=(
        "Étape 1 : crée le compte avec prénom, nom, email et mot de passe, puis retourne "
        "un registration_token permettant de remplir immédiatement les informations personnelles."
    ),
    security=PUBLIC_SECURITY,
    manual_parameters=REGISTER_PARAMETERS,
    responses={
        201: openapi.Response("Compte créé", RegisterResponseSerializer()),
        400: openapi.Response("Données invalides", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

registration_profile_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Authentification"],
    operation_id="auth_register_profile",
    operation_summary="Compléter les informations personnelles après inscription",
    operation_description=(
        "Étape 2 du flux d'inscription. Utilise le registration_token retourné à l'étape 1. "
        "Cet endpoint ne crée pas de session et ne remplace pas la vérification email."
    ),
    security=PUBLIC_SECURITY,
    manual_parameters=REGISTRATION_PROFILE_PARAMETERS,
    responses={
        200: openapi.Response("Profil d'inscription complété", RegistrationProfileResponseSerializer()),
        400: openapi.Response("Données ou token invalides", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)


agent_register_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Authentification"],
    operation_id="auth_register_agent",
    operation_summary="Créer un compte agent",
    operation_description=(
        "Endpoint réservé aux administrateurs. Le rôle agent est imposé côté serveur, "
        "puis l'agent suit le même parcours de vérification email et de connexion."
    ),
    security=JWT_SECURITY,
    manual_parameters=REGISTER_PARAMETERS,
    responses={
        201: openapi.Response("Compte agent créé", RegisterResponseSerializer()),
        400: openapi.Response("Données invalides", ERROR_RESPONSE),
        401: openapi.Response("Non authentifié", ERROR_RESPONSE),
        403: openapi.Response("Réservé aux administrateurs", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

verify_email_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Authentification"],
    operation_id="auth_verify_email",
    operation_summary="Vérifier une adresse email",
    security=PUBLIC_SECURITY,
    manual_parameters=VERIFY_EMAIL_PARAMETERS,
    responses={
        200: openapi.Response("Email vérifié", VerifyEmailResponseSerializer()),
        400: openapi.Response("Lien invalide ou expiré", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

resend_verification_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Authentification"],
    operation_id="auth_resend_verification",
    operation_summary="Renvoyer l'email de vérification",
    security=PUBLIC_SECURITY,
    manual_parameters=EMAIL_PARAMETER,
    responses={200: openapi.Response("Réponse neutre", MessageResponseSerializer()), 400: ERROR_RESPONSE},
)

login_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Authentification"],
    operation_id="auth_login",
    operation_summary="Connexion email / mot de passe",
    security=PUBLIC_SECURITY,
    manual_parameters=LOGIN_PARAMETERS,
    responses={200: openapi.Response("Connexion réussie", AuthResponseSerializer()), 400: ERROR_RESPONSE},
)

google_redirect_get_schema = swagger_auto_schema(
    tags=["Authentification Google"],
    operation_id="auth_google_redirect",
    operation_summary="Obtenir l'URL de connexion Google",
    security=PUBLIC_SECURITY,
    responses={200: openapi.Response("URL OAuth Google", GoogleRedirectResponseSerializer()), 400: ERROR_RESPONSE},
)

google_login_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Authentification Google"],
    operation_id="auth_google_login",
    operation_summary="Connexion Google",
    operation_description="Utiliser soit credential, soit le couple code + state.",
    security=PUBLIC_SECURITY,
    manual_parameters=GOOGLE_LOGIN_PARAMETERS,
    responses={200: openapi.Response("Connexion réussie", GoogleAuthResponseSerializer()), 400: ERROR_RESPONSE, 409: ERROR_RESPONSE},
)

logout_post_schema = swagger_auto_schema(
    auto_schema=NoBodyAutoSchema,
    tags=["Authentification"],
    operation_id="auth_logout",
    operation_summary="Déconnexion",
    security=PUBLIC_SECURITY,
    manual_parameters=[],
    responses={204: openapi.Response("Déconnexion réussie")},
)

refresh_post_schema = swagger_auto_schema(
    auto_schema=NoBodyAutoSchema,
    tags=["Authentification"],
    operation_id="auth_refresh",
    operation_summary="Rafraîchir le JWT depuis le cookie HttpOnly",
    security=PUBLIC_SECURITY,
    manual_parameters=[],
    responses={200: openapi.Response("Nouveau token", RefreshResponseSerializer()), 401: ERROR_RESPONSE},
)

password_reset_request_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Authentification"],
    operation_id="auth_password_reset_request",
    operation_summary="Demander une réinitialisation du mot de passe",
    security=PUBLIC_SECURITY,
    manual_parameters=EMAIL_PARAMETER,
    responses={200: openapi.Response("Réponse neutre", MessageResponseSerializer()), 400: ERROR_RESPONSE},
)

password_reset_confirm_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Authentification"],
    operation_id="auth_password_reset_confirm",
    operation_summary="Confirmer la réinitialisation du mot de passe",
    security=PUBLIC_SECURITY,
    manual_parameters=PASSWORD_RESET_CONFIRM_PARAMETERS,
    responses={200: openapi.Response("Mot de passe réinitialisé", MessageResponseSerializer()), 400: ERROR_RESPONSE},
)

profile_get_schema = swagger_auto_schema(
    tags=["Compte"],
    operation_id="account_profile_get",
    operation_summary="Récupérer le profil connecté",
    security=JWT_SECURITY,
    responses={200: openapi.Response("Profil", UserSerializer()), 401: ERROR_RESPONSE},
)

profile_patch_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Compte"],
    operation_id="account_profile_update",
    operation_summary="Modifier le profil connecté",
    operation_description="Accepte multipart/form-data, notamment pour le champ avatar.",
    security=JWT_SECURITY,
    manual_parameters=PROFILE_PARAMETERS,
    responses={200: openapi.Response("Profil mis à jour", UserSerializer()), 400: ERROR_RESPONSE, 401: ERROR_RESPONSE},
)

change_password_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Compte"],
    operation_id="account_change_password",
    operation_summary="Changer le mot de passe",
    operation_description=(
        "Confirmer l'identité avec current_password, ou avec Google via credential "
        "ou code + state. Pour un compte Google sans mot de passe local, cette route "
        "permet de définir le premier mot de passe après ré-authentification Google."
    ),
    security=JWT_SECURITY,
    manual_parameters=CHANGE_PASSWORD_PARAMETERS,
    responses={200: openapi.Response("Mot de passe modifié", MessageResponseSerializer()), 400: ERROR_RESPONSE},
)

set_password_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Compte"],
    operation_id="account_set_password",
    operation_summary="Définir un mot de passe local",
    operation_description=(
        "Pour un compte Google sans mot de passe, une ré-authentification Google "
        "est requise via credential ou code + state."
    ),
    security=JWT_SECURITY,
    manual_parameters=SET_PASSWORD_PARAMETERS,
    responses={200: openapi.Response("Mot de passe configuré", MessageResponseSerializer()), 400: ERROR_RESPONSE},
)

change_email_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Compte"],
    operation_id="account_change_email_request",
    operation_summary="Demander un changement d'adresse email",
    security=JWT_SECURITY,
    manual_parameters=CHANGE_EMAIL_PARAMETERS,
    responses={200: openapi.Response("Email de confirmation envoyé", MessageResponseSerializer()), 400: ERROR_RESPONSE},
)

change_email_confirm_post_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Compte"],
    operation_id="account_change_email_confirm",
    operation_summary="Confirmer le changement d'adresse email",
    security=PUBLIC_SECURITY,
    manual_parameters=CHANGE_EMAIL_CONFIRM_PARAMETERS,
    responses={200: openapi.Response("Adresse email modifiée", ChangeEmailConfirmResponseSerializer()), 400: ERROR_RESPONSE},
)

delete_account_schema = swagger_auto_schema(
    auto_schema=ManualFormAutoSchema,
    tags=["Compte"],
    operation_id="account_delete",
    operation_summary="Supprimer définitivement le compte",
    operation_description=(
        "Compte local : current_password requis. Compte Google : ré-authentification "
        "Google requise. Compte hybride : current_password ou Google au choix. "
        "Le champ confirmation doit toujours valoir DELETE."
    ),
    security=JWT_SECURITY,
    manual_parameters=DELETE_ACCOUNT_PARAMETERS,
    responses={204: openapi.Response("Compte supprimé"), 400: ERROR_RESPONSE, 401: ERROR_RESPONSE},
)
