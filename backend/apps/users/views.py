import logging

from django.conf import settings
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.models import update_last_login
from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from helpers.permissions import IsAuthenticatedAdmin, IsAuthenticatedAnyRole

from .auth_cookies import (
    build_refresh_token,
    clear_refresh_cookie,
    get_refresh_cookie,
    no_store,
    remember_from_refresh,
    set_refresh_cookie,
)
from .models import User
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
    ProfileUpdateSerializer,
    RegisterSerializer,
    SetPasswordSerializer,
    UserSerializer,
    VerifyEmailSerializer,
)
from .swagger import (
    agent_register_post_schema,
    change_email_confirm_post_schema,
    change_email_post_schema,
    change_password_post_schema,
    delete_account_schema,
    google_login_post_schema,
    google_redirect_get_schema,
    login_post_schema,
    logout_post_schema,
    password_reset_confirm_post_schema,
    password_reset_request_post_schema,
    profile_get_schema,
    profile_patch_schema,
    refresh_post_schema,
    register_post_schema,
    resend_verification_post_schema,
    set_password_post_schema,
    verify_email_post_schema,
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


def user_payload(user, request):
    return UserSerializer(user, context={"request": request}).data


def auth_response(user, request, *, remember=None, extra=None, status_code=status.HTTP_200_OK):
    if remember is None:
        remember = settings.AUTH_COOKIE_REMEMBER_DEFAULT

    refresh = build_refresh_token(user, remember=remember)
    payload = {"access": str(refresh.access_token), "user": user_payload(user, request)}
    if extra:
        payload = {**extra, **payload}

    response = Response(payload, status=status_code)
    set_refresh_cookie(response, str(refresh), remember=remember)
    return no_store(response)


def server_error(exc, view_name):
    logger.exception("Erreur non gérée dans %s", view_name, exc_info=exc)
    return Response(
        {"detail": "Une erreur interne est survenue."},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


class RegisterView(APIView):
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth"

    @register_post_schema
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


class AgentRegisterView(APIView):
    """Crée un compte agent puis applique le même parcours de vérification email.

    La création d'un compte privilégié reste réservée aux administrateurs afin
    qu'un visiteur public ne puisse jamais s'auto-attribuer le rôle agent.
    """

    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [IsAuthenticatedAdmin]
    throttle_scope = "auth"

    @agent_register_post_schema
    def post(self, request):
        try:
            with transaction.atomic():
                serializer = AgentRegisterSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                user = serializer.save()
                transaction.on_commit(lambda: send_verification_email(user), robust=True)
            return Response(
                {
                    "message": "Compte agent créé. L'agent doit vérifier son adresse email pour terminer l'inscription.",
                    "user": user_payload(user, request),
                },
                status=status.HTTP_201_CREATED,
            )
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class VerifyEmailView(APIView):
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [AllowAny]
    authentication_classes = []

    @verify_email_post_schema
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
            return auth_response(
                user,
                request,
                extra={"message": "Adresse email vérifiée."},
            )
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class ResendVerificationView(APIView):
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth_email"

    @resend_verification_post_schema
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
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth"

    @login_post_schema
    def post(self, request):
        try:
            serializer = LoginSerializer(data=request.data, context={"request": request})
            serializer.is_valid(raise_exception=True)
            user = serializer.validated_data["user"]
            remember = serializer.validated_data.get(
                "remember", settings.AUTH_COOKIE_REMEMBER_DEFAULT
            )
            update_last_login(None, user)
            return auth_response(user, request, remember=remember)
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class GoogleRedirectView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @google_redirect_get_schema
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
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth"

    @google_login_post_schema
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

            remember = serializer.validated_data.get(
                "remember", settings.AUTH_COOKIE_REMEMBER_DEFAULT
            )
            return auth_response(
                user,
                request,
                remember=remember,
                extra={"created": created},
            )
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class LogoutView(APIView):
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [AllowAny]
    authentication_classes = []

    @logout_post_schema
    def post(self, request):
        try:
            refresh_value = get_refresh_cookie(request)
            if refresh_value:
                try:
                    RefreshToken(refresh_value).blacklist()
                except TokenError:
                    # Même si le token est expiré/invalide, la déconnexion locale
                    # doit toujours supprimer le cookie navigateur.
                    pass

            response = Response(status=status.HTTP_204_NO_CONTENT)
            clear_refresh_cookie(response)
            return no_store(response)
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class RefreshView(APIView):
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [AllowAny]
    authentication_classes = []

    @refresh_post_schema
    def post(self, request):
        try:
            refresh_value = get_refresh_cookie(request)
            if not refresh_value:
                return no_store(Response(
                    {"detail": "Session expirée. Reconnectez-vous."},
                    status=status.HTTP_401_UNAUTHORIZED,
                ))

            try:
                remember = remember_from_refresh(refresh_value)
                serializer = TokenRefreshSerializer(data={"refresh": refresh_value})
                serializer.is_valid(raise_exception=True)
            except TokenError:
                response = Response(
                    {"detail": "Session expirée. Reconnectez-vous."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
                clear_refresh_cookie(response)
                return no_store(response)

            rotated_refresh = serializer.validated_data.get("refresh", refresh_value)
            response = Response(
                {"access": serializer.validated_data["access"]},
                status=status.HTTP_200_OK,
            )
            set_refresh_cookie(response, rotated_refresh, remember=remember)
            return no_store(response)
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class PasswordResetRequestView(APIView):
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "password_reset"

    @password_reset_request_post_schema
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
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [AllowAny]
    authentication_classes = []

    @password_reset_confirm_post_schema
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
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [IsAuthenticatedAnyRole]

    @profile_get_schema
    def get(self, request):
        try:
            return Response(user_payload(request.user, request))
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)

    @profile_patch_schema
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
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [IsAuthenticatedAnyRole]

    @change_password_post_schema
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
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [IsAuthenticatedAnyRole]

    @set_password_post_schema
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
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [IsAuthenticatedAnyRole]

    @change_email_post_schema
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
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [AllowAny]
    authentication_classes = []

    @change_email_confirm_post_schema
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
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [IsAuthenticatedAnyRole]

    @delete_account_schema
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
