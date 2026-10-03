"""Documentation Swagger/OpenAPI des endpoints utilisateurs.

Ce module contient exclusivement la documentation HTTP : schémas de réponses,
paramètres multipart et décorateurs drf-yasg. La logique métier reste dans
``apps.users.views``.
"""

from django.utils.decorators import method_decorator
from drf_yasg import openapi
from drf_yasg.utils import no_body, swagger_auto_schema
from rest_framework import serializers

from .serializers import (
    AgentRegisterSerializer,
    ChangeEmailConfirmSerializer,
    ChangeEmailRequestSerializer,
    ChangePasswordSerializer,
    DeleteAccountSerializer,
    EmailOnlySerializer,
    GoogleAuthSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    RegisterSerializer,
    SetPasswordSerializer,
    UserSerializer,
    VerifyEmailSerializer,
)
from .views import (
    AgentRegisterView,
    ChangeEmailConfirmView,
    ChangeEmailRequestView,
    ChangePasswordView,
    DeleteAccountView,
    GoogleLoginView,
    GoogleRedirectView,
    LoginView,
    LogoutView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    ProfileView,
    RefreshView,
    RegisterView,
    ResendVerificationView,
    SetPasswordView,
    VerifyEmailView,
)

PUBLIC_SECURITY = []
JWT_SECURITY = [{"Bearer": []}]


# -----------------------------------------------------------------------------
# Schémas de réponses contractuels
# -----------------------------------------------------------------------------

class MessageResponseSerializer(serializers.Serializer):
    message = serializers.CharField()


class ApiErrorResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    errors = serializers.JSONField(
        required=False,
        help_text="Détail champ par champ présent pour les erreurs de validation.",
    )


class RegisterResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    user = UserSerializer()


class AuthResponseSerializer(serializers.Serializer):
    access = serializers.CharField(help_text="Access token JWT. Le refresh token est dans un cookie HttpOnly.")
    user = UserSerializer()


class VerifyEmailResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    access = serializers.CharField(help_text="Access token JWT. Le refresh token est dans un cookie HttpOnly.")
    user = UserSerializer()


class GoogleAuthResponseSerializer(serializers.Serializer):
    created = serializers.BooleanField(
        help_text="true si le compte a été créé pendant cette connexion Google."
    )
    access = serializers.CharField(help_text="Access token JWT. Le refresh token est dans un cookie HttpOnly.")
    user = UserSerializer()


class GoogleRedirectResponseSerializer(serializers.Serializer):
    authorization_url = serializers.URLField(
        help_text="URL Google OAuth complète vers laquelle rediriger le navigateur."
    )
    redirect_uri = serializers.URLField(
        help_text="URI de callback configurée côté Google et backend."
    )
    state = serializers.CharField(
        help_text="State signé à renvoyer avec le code OAuth à POST /api/auth/google/."
    )


class RefreshResponseSerializer(serializers.Serializer):
    access = serializers.CharField(help_text="Nouveau access token JWT. Le refresh rotatif reste en cookie HttpOnly.")


class ChangeEmailConfirmResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    email = serializers.EmailField()


ERROR_RESPONSE = ApiErrorResponseSerializer()


# -----------------------------------------------------------------------------
# Paramètres multipart : aucun request_body Swagger pour un endpoint fichier.
# -----------------------------------------------------------------------------

PROFILE_MULTIPART_PARAMETERS = [
    openapi.Parameter(
        "first_name",
        openapi.IN_FORM,
        description="Prénom",
        type=openapi.TYPE_STRING,
        required=False,
    ),
    openapi.Parameter(
        "last_name",
        openapi.IN_FORM,
        description="Nom",
        type=openapi.TYPE_STRING,
        required=False,
    ),
    openapi.Parameter(
        "phone_number",
        openapi.IN_FORM,
        description="Numéro de téléphone",
        type=openapi.TYPE_STRING,
        required=False,
    ),
    openapi.Parameter(
        "avatar",
        openapi.IN_FORM,
        description="Photo de profil",
        type=openapi.TYPE_FILE,
        required=False,
    ),
    openapi.Parameter(
        "locale",
        openapi.IN_FORM,
        description="Locale utilisateur, par exemple fr ou fr-FR",
        type=openapi.TYPE_STRING,
        required=False,
    ),
]


def _document(view_class, method_name, **schema_kwargs):
    """Applique un swagger_auto_schema à une méthode sans toucher au fichier views.py."""
    return method_decorator(
        name=method_name,
        decorator=swagger_auto_schema(**schema_kwargs),
    )(view_class)


RegisterView = _document(
    RegisterView,
    "post",
    tags=["Authentification"],
    operation_id="auth_register",
    operation_summary="Créer un compte",
    operation_description="Crée un compte local et envoie un email de vérification.",
    security=PUBLIC_SECURITY,
    request_body=RegisterSerializer,
    responses={
        201: openapi.Response("Compte créé", RegisterResponseSerializer()),
        400: openapi.Response("Données invalides", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

AgentRegisterView = _document(
    AgentRegisterView,
    "post",
    tags=["Authentification"],
    operation_id="auth_register_agent",
    operation_summary="Créer un compte agent",
    operation_description=(
        "Crée un compte avec le rôle agent. Endpoint réservé aux administrateurs. "
        "L'agent reçoit ensuite le même email de vérification qu'un citoyen, puis "
        "utilise les endpoints standards de vérification et de connexion."
    ),
    security=JWT_SECURITY,
    request_body=AgentRegisterSerializer,
    responses={
        201: openapi.Response("Compte agent créé", RegisterResponseSerializer()),
        400: openapi.Response("Données invalides", ERROR_RESPONSE),
        401: openapi.Response("Non authentifié", ERROR_RESPONSE),
        403: openapi.Response("Réservé aux administrateurs", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

VerifyEmailView = _document(
    VerifyEmailView,
    "post",
    tags=["Authentification"],
    operation_id="auth_verify_email",
    operation_summary="Vérifier une adresse email",
    security=PUBLIC_SECURITY,
    request_body=VerifyEmailSerializer,
    responses={
        200: openapi.Response("Email vérifié", VerifyEmailResponseSerializer()),
        400: openapi.Response("Lien invalide ou expiré", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

ResendVerificationView = _document(
    ResendVerificationView,
    "post",
    tags=["Authentification"],
    operation_id="auth_resend_verification",
    operation_summary="Renvoyer l'email de vérification",
    security=PUBLIC_SECURITY,
    request_body=EmailOnlySerializer,
    responses={
        200: openapi.Response("Réponse neutre", MessageResponseSerializer()),
        400: openapi.Response("Email invalide", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

LoginView = _document(
    LoginView,
    "post",
    tags=["Authentification"],
    operation_id="auth_login",
    operation_summary="Connexion email / mot de passe",
    security=PUBLIC_SECURITY,
    request_body=LoginSerializer,
    responses={
        200: openapi.Response("Connexion réussie", AuthResponseSerializer()),
        400: openapi.Response("Identifiants invalides ou email non vérifié", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

GoogleRedirectView = _document(
    GoogleRedirectView,
    "get",
    tags=["Authentification Google"],
    operation_id="auth_google_redirect",
    operation_summary="Obtenir l'URL de connexion Google",
    operation_description=(
        "Construit l'URL OAuth Google à ouvrir côté frontend. Google redirige ensuite vers "
        "GOOGLE_REDIRECT_URI avec les paramètres code et state. Le frontend renvoie ensuite "
        "code et state à POST /api/auth/google/."
    ),
    security=PUBLIC_SECURITY,
    responses={
        200: openapi.Response("URL OAuth Google", GoogleRedirectResponseSerializer()),
        400: openapi.Response("Configuration Google incomplète", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

GoogleLoginView = _document(
    GoogleLoginView,
    "post",
    tags=["Authentification Google"],
    operation_id="auth_google_login",
    operation_summary="Connexion Google",
    operation_description=(
        "Deux formats de requête sont acceptés : soit {credential}, provenant de Google "
        "Identity Services, soit {code, state}, obtenus après le flux de redirection OAuth. "
        "Les deux modes ne doivent jamais être envoyés simultanément."
    ),
    security=PUBLIC_SECURITY,
    request_body=GoogleAuthSerializer,
    responses={
        200: openapi.Response("Connexion Google réussie", GoogleAuthResponseSerializer()),
        400: openapi.Response("Credential, code ou state invalide", ERROR_RESPONSE),
        409: openapi.Response("Conflit d'identité Google", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

LogoutView = _document(
    LogoutView,
    "post",
    tags=["Authentification"],
    operation_id="auth_logout",
    operation_summary="Déconnexion et révocation du refresh token",
    operation_description="Le refresh token est lu puis supprimé depuis le cookie HttpOnly.",
    security=PUBLIC_SECURITY,
    request_body=no_body,
    responses={
        204: openapi.Response("Déconnexion réussie ; cookie supprimé"),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

RefreshView = _document(
    RefreshView,
    "post",
    tags=["Authentification"],
    operation_id="auth_refresh",
    operation_summary="Rafraîchir le JWT",
    operation_description=(
        "Le refresh token est lu dans le cookie HttpOnly. Sa rotation reste côté serveur/navigateur ; "
        "seul le nouvel access token est retourné au frontend."
    ),
    security=PUBLIC_SECURITY,
    request_body=no_body,
    responses={
        200: openapi.Response("Nouveau access token", RefreshResponseSerializer()),
        401: openapi.Response("Session absente, invalide ou expirée", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

PasswordResetRequestView = _document(
    PasswordResetRequestView,
    "post",
    tags=["Authentification"],
    operation_id="auth_password_reset_request",
    operation_summary="Demander une réinitialisation du mot de passe",
    security=PUBLIC_SECURITY,
    request_body=EmailOnlySerializer,
    responses={
        200: openapi.Response("Réponse neutre", MessageResponseSerializer()),
        400: openapi.Response("Email invalide", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

PasswordResetConfirmView = _document(
    PasswordResetConfirmView,
    "post",
    tags=["Authentification"],
    operation_id="auth_password_reset_confirm",
    operation_summary="Confirmer la réinitialisation du mot de passe",
    security=PUBLIC_SECURITY,
    request_body=PasswordResetConfirmSerializer,
    responses={
        200: openapi.Response("Mot de passe réinitialisé", MessageResponseSerializer()),
        400: openapi.Response("Lien ou mot de passe invalide", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

ProfileView = _document(
    ProfileView,
    "get",
    tags=["Compte"],
    operation_id="account_profile_get",
    operation_summary="Récupérer le profil connecté",
    security=JWT_SECURITY,
    responses={
        200: openapi.Response("Profil utilisateur", UserSerializer()),
        401: openapi.Response("Non authentifié", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

ProfileView = _document(
    ProfileView,
    "patch",
    tags=["Compte"],
    operation_id="account_profile_update",
    operation_summary="Modifier le profil connecté",
    operation_description=(
        "Requête exclusivement multipart/form-data afin de supporter avatar. "
        "Cet endpoint ne déclare volontairement aucun request_body Swagger."
    ),
    security=JWT_SECURITY,
    manual_parameters=PROFILE_MULTIPART_PARAMETERS,
    responses={
        200: openapi.Response("Profil mis à jour", UserSerializer()),
        400: openapi.Response("Données invalides", ERROR_RESPONSE),
        401: openapi.Response("Non authentifié", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

ChangePasswordView = _document(
    ChangePasswordView,
    "post",
    tags=["Compte"],
    operation_id="account_change_password",
    operation_summary="Changer le mot de passe",
    security=JWT_SECURITY,
    request_body=ChangePasswordSerializer,
    responses={
        200: openapi.Response("Mot de passe modifié", MessageResponseSerializer()),
        400: openapi.Response("Mot de passe invalide", ERROR_RESPONSE),
        401: openapi.Response("Non authentifié", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

SetPasswordView = _document(
    SetPasswordView,
    "post",
    tags=["Compte"],
    operation_id="account_set_password",
    operation_summary="Définir un mot de passe local",
    security=JWT_SECURITY,
    request_body=SetPasswordSerializer,
    responses={
        200: openapi.Response("Mot de passe configuré", MessageResponseSerializer()),
        400: openapi.Response("Mot de passe invalide", ERROR_RESPONSE),
        401: openapi.Response("Non authentifié", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

ChangeEmailRequestView = _document(
    ChangeEmailRequestView,
    "post",
    tags=["Compte"],
    operation_id="account_change_email_request",
    operation_summary="Demander un changement d'adresse email",
    security=JWT_SECURITY,
    request_body=ChangeEmailRequestSerializer,
    responses={
        200: openapi.Response("Email de confirmation envoyé", MessageResponseSerializer()),
        400: openapi.Response("Adresse ou mot de passe invalide", ERROR_RESPONSE),
        401: openapi.Response("Non authentifié", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

ChangeEmailConfirmView = _document(
    ChangeEmailConfirmView,
    "post",
    tags=["Compte"],
    operation_id="account_change_email_confirm",
    operation_summary="Confirmer le changement d'adresse email",
    security=PUBLIC_SECURITY,
    request_body=ChangeEmailConfirmSerializer,
    responses={
        200: openapi.Response("Adresse email modifiée", ChangeEmailConfirmResponseSerializer()),
        400: openapi.Response("Token invalide ou expiré", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)

DeleteAccountView = _document(
    DeleteAccountView,
    "delete",
    tags=["Compte"],
    operation_id="account_delete",
    operation_summary="Supprimer définitivement le compte",
    security=JWT_SECURITY,
    request_body=DeleteAccountSerializer,
    responses={
        204: openapi.Response("Compte supprimé ; aucune réponse JSON"),
        400: openapi.Response("Confirmation ou mot de passe invalide", ERROR_RESPONSE),
        401: openapi.Response("Non authentifié", ERROR_RESPONSE),
        500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
    },
)


__all__ = [
    "RegisterView",
    "AgentRegisterView",
    "VerifyEmailView",
    "ResendVerificationView",
    "LoginView",
    "GoogleRedirectView",
    "GoogleLoginView",
    "LogoutView",
    "RefreshView",
    "PasswordResetRequestView",
    "PasswordResetConfirmView",
    "ProfileView",
    "ChangePasswordView",
    "SetPasswordView",
    "ChangeEmailRequestView",
    "ChangeEmailConfirmView",
    "DeleteAccountView",
]
