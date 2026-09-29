import logging

from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.models import update_last_login
from django.db import transaction
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
    ChangeEmailConfirmSerializer,
    ChangeEmailRequestSerializer,
    ChangePasswordSerializer,
    DeleteAccountSerializer,
    EmailOnlySerializer,
    GoogleAuthSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    ProfileUpdateSerializer,
    RefreshRequestSerializer,
    RegisterSerializer,
    SetPasswordSerializer,
    UserSerializer,
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

    def get(self, request):
        try:
            return Response(user_payload(request.user, request))
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)

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
