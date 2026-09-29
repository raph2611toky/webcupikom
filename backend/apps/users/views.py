import logging

from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.models import update_last_login
from django.db import transaction
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import (
    AuthResponseSerializer,
    ChangeEmailConfirmResponseSerializer,
    ChangeEmailConfirmSerializer,
    ChangeEmailRequestSerializer,
    ChangePasswordSerializer,
    DeleteAccountSerializer,
    EmailOnlySerializer,
    GoogleAuthResponseSerializer,
    GoogleAuthSerializer,
    GoogleRedirectResponseSerializer,
    LoginSerializer,
    MessageResponseSerializer,
    PasswordResetConfirmSerializer,
    ProfileUpdateSerializer,
    RefreshRequestSerializer,
    RefreshResponseSerializer,
    RegisterResponseSerializer,
    RegisterSerializer,
    SetPasswordSerializer,
    UserSerializer,
    ValidationErrorResponseSerializer,
    VerifyEmailResponseSerializer,
    VerifyEmailSerializer,
)
from .services.account_emails import (
    send_account_deleted_email,
    send_change_email_confirmation,
    send_email_changed_notice,
    send_password_changed_email,
    send_password_reset_email,
    send_security_alert,
    send_verification_email,
    send_welcome_email,
)
from .services.google_identity import (
    GoogleIdentityError,
    build_google_authorization_url,
    exchange_google_authorization_code,
    verify_google_credential,
)

logger = logging.getLogger(__name__)

PUBLIC_SECURITY = []
JWT_SECURITY = [{"Bearer": []}]
ERROR_RESPONSE = ValidationErrorResponseSerializer()

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


def token_pair(user):
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


def user_payload(user, request):
    return UserSerializer(user, context={"request": request}).data


def server_error(exc, view_name):
    logger.exception("Erreur non gérée dans %s", view_name, exc_info=exc)
    return Response(
        {"detail": "Une erreur interne est survenue."},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @swagger_auto_schema(
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
    def post(self, request):
        try:
            with transaction.atomic():
                serializer = RegisterSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                user = serializer.save()
                transaction.on_commit(lambda: send_verification_email(user), robust=True)
            return Response(
                {
                    "message": "Compte créé. Vérifiez votre adresse email pour terminer l'inscription.",
                    "user": user_payload(user, request),
                },
                status=status.HTTP_201_CREATED,
            )
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @swagger_auto_schema(
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
    def post(self, request):
        try:
            with transaction.atomic():
                serializer = VerifyEmailSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                user = serializer.validated_data["user"]
                if not serializer.validated_data["already_verified"]:
                    user.email_verified = True
                    user.is_active = True
                    user.save(update_fields=["email_verified", "is_active", "updated_at"])
                    transaction.on_commit(lambda: send_welcome_email(user), robust=True)
                update_last_login(None, user)
            return Response({
                "message": "Adresse email vérifiée.",
                "tokens": token_pair(user),
                "user": user_payload(user, request),
            })
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class ResendVerificationView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @swagger_auto_schema(
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
    def post(self, request):
        try:
            serializer = EmailOnlySerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            user = User.objects.filter(
                email__iexact=serializer.validated_data["email"],
                is_active=True,
            ).first()
            if user and not user.email_verified:
                try:
                    send_verification_email(user)
                except Exception:
                    logger.exception("Échec d'envoi de l'email de vérification")
            return Response({
                "message": "Si le compte existe et n'est pas vérifié, un nouvel email a été envoyé."
            })
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @swagger_auto_schema(
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
    def post(self, request):
        try:
            serializer = LoginSerializer(data=request.data, context={"request": request})
            serializer.is_valid(raise_exception=True)
            user = serializer.validated_data["user"]
            update_last_login(None, user)
            return Response({"tokens": token_pair(user), "user": user_payload(user, request)})
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class GoogleRedirectView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @swagger_auto_schema(
        tags=["Authentification Google"],
        operation_id="auth_google_redirect",
        operation_summary="Obtenir l'URL de connexion Google",
        operation_description=(
            "Construit l'URL OAuth Google à ouvrir côté frontend. Google redirige ensuite vers "
            "GOOGLE_REDIRECT_URI avec les paramètres code et state. Le frontend renvoie ces deux "
            "valeurs à POST /api/auth/google/."
        ),
        security=PUBLIC_SECURITY,
        responses={
            200: openapi.Response("URL OAuth Google", GoogleRedirectResponseSerializer()),
            400: openapi.Response("Configuration Google incomplète", ERROR_RESPONSE),
            500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
        },
    )
    def get(self, request):
        try:
            authorization_url, state_value = build_google_authorization_url()
            from django.conf import settings

            return Response({
                "authorization_url": authorization_url,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "state": state_value,
            })
        except GoogleIdentityError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class GoogleLoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @swagger_auto_schema(
        tags=["Authentification Google"],
        operation_id="auth_google_login",
        operation_summary="Connexion Google",
        operation_description=(
            "Deux modes compatibles : (1) envoyer credential depuis Google Identity Services ; "
            "ou (2) envoyer code + state obtenus après redirection OAuth."
        ),
        security=PUBLIC_SECURITY,
        request_body=GoogleAuthSerializer,
        responses={
            200: openapi.Response("Connexion Google réussie", GoogleAuthResponseSerializer()),
            400: openapi.Response("Jeton/code/state invalide", ERROR_RESPONSE),
            409: openapi.Response("Conflit d'identité Google", ERROR_RESPONSE),
            500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
        },
    )
    def post(self, request):
        try:
            serializer = GoogleAuthSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            try:
                if serializer.validated_data.get("credential"):
                    payload = verify_google_credential(serializer.validated_data["credential"])
                else:
                    payload = exchange_google_authorization_code(
                        serializer.validated_data["code"],
                        serializer.validated_data["state"],
                    )
            except GoogleIdentityError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

            with transaction.atomic():
                sub = payload["sub"]
                email = payload["email"].strip().lower()
                user = User.objects.filter(google_sub=sub).first()
                created = False

                if user is None:
                    user = User.objects.filter(email__iexact=email).first()
                    if user:
                        if user.google_sub and user.google_sub != sub:
                            return Response(
                                {"detail": "Ce compte est déjà associé à une autre identité Google."},
                                status=status.HTTP_409_CONFLICT,
                            )
                    else:
                        user = User.objects.create_user(
                            email=email,
                            password=None,
                            first_name=payload.get("given_name", ""),
                            last_name=payload.get("family_name", ""),
                            avatar_url=payload.get("picture", ""),
                            google_sub=sub,
                            auth_provider=User.AuthProvider.GOOGLE,
                            email_verified=True,
                            is_active=True,
                            locale=payload.get("locale", "fr")[:12],
                        )
                        created = True

                if not created:
                    changed = []
                    if not user.email_verified:
                        user.email_verified = True
                        changed.append("email_verified")
                    if not user.is_active:
                        user.is_active = True
                        changed.append("is_active")
                    if not user.avatar_url and payload.get("picture"):
                        user.avatar_url = payload["picture"]
                        changed.append("avatar_url")
                    if user.google_sub != sub:
                        user.google_sub = sub
                        changed.append("google_sub")
                    desired_provider = (
                        User.AuthProvider.HYBRID
                        if user.has_usable_password()
                        else User.AuthProvider.GOOGLE
                    )
                    if user.auth_provider != desired_provider:
                        user.auth_provider = desired_provider
                        changed.append("auth_provider")
                    if changed:
                        changed.append("updated_at")
                        user.save(update_fields=changed)

                update_last_login(None, user)
                if created:
                    transaction.on_commit(lambda: send_welcome_email(user), robust=True)

            return Response({
                "created": created,
                "tokens": token_pair(user),
                "user": user_payload(user, request),
            })
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        tags=["Authentification"],
        operation_id="auth_logout",
        operation_summary="Déconnexion et révocation du refresh token",
        security=JWT_SECURITY,
        request_body=RefreshRequestSerializer,
        responses={
            204: openapi.Response("Déconnexion réussie, aucune réponse JSON"),
            400: openapi.Response("Refresh token manquant ou invalide", ERROR_RESPONSE),
            401: openapi.Response("Non authentifié", ERROR_RESPONSE),
            500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
        },
    )
    def post(self, request):
        try:
            serializer = RefreshRequestSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            try:
                RefreshToken(serializer.validated_data["refresh"]).blacklist()
            except TokenError:
                return Response(
                    {"detail": "Refresh token invalide ou déjà révoqué."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class RefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @swagger_auto_schema(
        tags=["Authentification"],
        operation_id="auth_refresh",
        operation_summary="Rafraîchir le JWT",
        security=PUBLIC_SECURITY,
        request_body=RefreshRequestSerializer,
        responses={
            200: openapi.Response("Nouveau token d'accès", RefreshResponseSerializer()),
            400: openapi.Response("Refresh token requis", ERROR_RESPONSE),
            401: openapi.Response("Refresh token invalide ou expiré", ERROR_RESPONSE),
            500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
        },
    )
    def post(self, request):
        try:
            serializer = TokenRefreshSerializer(data=request.data)
            try:
                serializer.is_valid(raise_exception=True)
            except TokenError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_401_UNAUTHORIZED)
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @swagger_auto_schema(
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
    def post(self, request):
        try:
            serializer = EmailOnlySerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            user = User.objects.filter(
                email__iexact=serializer.validated_data["email"],
                is_active=True,
            ).first()
            if user:
                try:
                    send_password_reset_email(user)
                except Exception:
                    logger.exception("Échec d'envoi de l'email de réinitialisation")
            return Response({
                "message": "Si un compte actif correspond à cet email, les instructions ont été envoyées."
            })
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @swagger_auto_schema(
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
    def post(self, request):
        try:
            with transaction.atomic():
                serializer = PasswordResetConfirmSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                user = serializer.validated_data["user"]
                user.set_password(serializer.validated_data["new_password"])
                if user.google_sub:
                    user.auth_provider = User.AuthProvider.HYBRID
                else:
                    user.auth_provider = User.AuthProvider.LOCAL
                user.save(update_fields=["password", "auth_provider", "updated_at"])
                transaction.on_commit(lambda: send_password_changed_email(user), robust=True)
            return Response({
                "message": "Mot de passe réinitialisé. Vous pouvez maintenant vous connecter."
            })
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    @swagger_auto_schema(
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
    def get(self, request):
        try:
            return Response(user_payload(request.user, request))
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)

    @swagger_auto_schema(
        tags=["Compte"],
        operation_id="account_profile_update",
        operation_summary="Modifier le profil connecté",
        operation_description=(
            "Requête exclusivement multipart/form-data afin de supporter l'avatar. "
            "Aucun body JSON n'est déclaré dans Swagger."
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
    def patch(self, request):
        try:
            serializer = ProfileUpdateSerializer(
                request.user,
                data=request.data,
                partial=True,
                context={"request": request},
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(user_payload(request.user, request))
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
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
    def post(self, request):
        try:
            serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
            serializer.is_valid(raise_exception=True)
            user = request.user
            user.set_password(serializer.validated_data["new_password"])
            if user.google_sub:
                user.auth_provider = User.AuthProvider.HYBRID
            user.save(update_fields=["password", "auth_provider", "updated_at"])
            update_session_auth_hash(request, user)
            try:
                send_password_changed_email(user)
            except Exception:
                logger.exception("Échec d'envoi de l'email de changement de mot de passe")
            return Response({"message": "Mot de passe modifié."})
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class SetPasswordView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
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
    def post(self, request):
        try:
            serializer = SetPasswordSerializer(data=request.data, context={"request": request})
            serializer.is_valid(raise_exception=True)
            user = request.user
            user.set_password(serializer.validated_data["new_password"])
            user.auth_provider = User.AuthProvider.HYBRID if user.google_sub else User.AuthProvider.LOCAL
            user.save(update_fields=["password", "auth_provider", "updated_at"])
            try:
                send_password_changed_email(user)
            except Exception:
                logger.exception("Échec d'envoi de l'email de configuration du mot de passe")
            return Response({"message": "Mot de passe local configuré."})
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class ChangeEmailRequestView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
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
    def post(self, request):
        try:
            serializer = ChangeEmailRequestSerializer(data=request.data, context={"request": request})
            serializer.is_valid(raise_exception=True)
            new_email = serializer.validated_data["new_email"]
            send_change_email_confirmation(request.user, new_email)
            send_security_alert(
                request.user,
                f"Une demande de changement d'adresse email vers {new_email} a été effectuée.",
            )
            return Response({"message": "Un email de confirmation a été envoyé à la nouvelle adresse."})
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class ChangeEmailConfirmView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @swagger_auto_schema(
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
    def post(self, request):
        try:
            with transaction.atomic():
                serializer = ChangeEmailConfirmSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                user = serializer.validated_data["user"]
                old_email = user.email
                user.email = serializer.validated_data["new_email"]
                user.email_verified = True
                user.save(update_fields=["email", "email_verified", "updated_at"])
                transaction.on_commit(
                    lambda: send_email_changed_notice(old_email=old_email, user=user),
                    robust=True,
                )
            return Response({"message": "Adresse email modifiée.", "email": user.email})
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        tags=["Compte"],
        operation_id="account_delete",
        operation_summary="Supprimer définitivement le compte",
        security=JWT_SECURITY,
        request_body=DeleteAccountSerializer,
        responses={
            204: openapi.Response("Compte supprimé, aucune réponse JSON"),
            400: openapi.Response("Confirmation ou mot de passe invalide", ERROR_RESPONSE),
            401: openapi.Response("Non authentifié", ERROR_RESPONSE),
            500: openapi.Response("Erreur serveur", ERROR_RESPONSE),
        },
    )
    def delete(self, request):
        try:
            with transaction.atomic():
                serializer = DeleteAccountSerializer(data=request.data, context={"request": request})
                serializer.is_valid(raise_exception=True)
                user = request.user
                email = user.email
                display_name = user.get_full_name().strip() or email.split("@", 1)[0]
                user.delete()
                transaction.on_commit(
                    lambda: send_account_deleted_email(email, display_name),
                    robust=True,
                )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)
