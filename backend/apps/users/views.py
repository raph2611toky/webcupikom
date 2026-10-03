import logging

from django.conf import settings
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.models import update_last_login
from django.db import transaction
from django.core import signing
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError, AuthenticationFailed
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .security_api import SecurityAPIView as APIView
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
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
    MFAConfirmSetupSerializer,
    MFADisableSerializer,
    MFARecoveryCodesRegenerateSerializer,
    MFASetupSerializer,
    MFAVerifyLoginSerializer,
    PasswordResetConfirmSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    RegistrationProfileSerializer,
    REGISTRATION_PROFILE_SALT,
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
    mfa_confirm_post_schema,
    mfa_disable_post_schema,
    mfa_recovery_regenerate_post_schema,
    mfa_setup_post_schema,
    mfa_status_get_schema,
    mfa_verify_login_post_schema,
    password_reset_confirm_post_schema,
    password_reset_request_post_schema,
    profile_get_schema,
    profile_patch_schema,
    refresh_post_schema,
    register_post_schema,
    registration_profile_post_schema,
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
from .services.mfa import (
    MFAError,
    build_otpauth_uri,
    clear_mfa,
    decrypt_secret,
    encrypt_secret,
    generate_recovery_codes,
    generate_totp_secret,
    issue_login_challenge,
    load_login_challenge,
    mark_mfa_enabled,
    qr_code_data_url,
    verify_totp_secret,
    verify_user_mfa,
)

logger = logging.getLogger(__name__)


def user_payload(user, request):
    return UserSerializer(user, context={"request": request}).data


def auth_response(user, request, *, remember=None, extra=None, status_code=status.HTTP_200_OK):
    if remember is None:
        remember = settings.AUTH_COOKIE_REMEMBER_DEFAULT

    with transaction.atomic():
        fresh = User.objects.select_for_update().get(pk=user.pk, is_active=True)
        if fresh.auth_token_version != user.auth_token_version:
            raise ValidationError('La sécurité du compte a changé. Reconnectez-vous.')
        user = fresh
        refresh = build_refresh_token(user, remember=remember, request=request)
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


def verify_sensitive_action_identity(user, validated_data, *, require_mfa=True):
    """Confirme une action sensible avec l'identité primaire et, si activé, le MFA."""
    current_password = validated_data.get("current_password")
    credential = validated_data.get("credential")
    code = validated_data.get("code")
    state_value = validated_data.get("state")

    if current_password:
        if not user.has_usable_password() or not user.check_password(current_password):
            raise ValidationError({"current_password": "Mot de passe actuel incorrect."})
        auth_method = "password"
    elif credential or (code and state_value):
        if not user.google_sub:
            raise ValidationError({"google": "Ce compte n'est pas associé à Google."})
        try:
            if credential:
                payload = verify_google_credential(credential)
            else:
                payload = exchange_google_authorization_code(code, state_value)
        except GoogleIdentityError as exc:
            raise ValidationError({"google": str(exc)}) from exc

        if payload.get("sub") != user.google_sub:
            raise ValidationError({
                "google": "Le compte Google utilisé ne correspond pas à celui associé à ce compte."
            })
        auth_method = "google"
    else:
        if user.google_sub and user.has_usable_password():
            raise ValidationError({
                "detail": "Confirmez l'action avec votre mot de passe actuel ou avec Google."
            })
        if user.google_sub:
            raise ValidationError({
                "google": "Une ré-authentification Google est requise pour confirmer cette action."
            })
        raise ValidationError({"current_password": "Le mot de passe actuel est requis."})

    if require_mfa and user.mfa_enabled and validated_data.get('email_code'):
        from .services.security_otp import consume_otp
        consume_otp(user, validated_data['email_challenge_id'], validated_data['email_code'],
                    'sensitive', validated_data.get('_security_binding', ''))
        return auth_method

    if require_mfa and user.mfa_enabled:
        try:
            mfa_method = verify_user_mfa(
                user,
                mfa_code=validated_data.get("mfa_code"),
                recovery_code=validated_data.get("recovery_code"),
            )
        except MFAError as exc:
            raise ValidationError({"mfa": str(exc)}) from exc

        update_fields = ["updated_at"]
        if mfa_method == "totp":
            update_fields.append("mfa_last_used_counter")
        else:
            update_fields.append("mfa_recovery_codes")
            transaction.on_commit(
                lambda: send_security_alert(
                    user,
                    "Un code de récupération MFA a été utilisé pour confirmer une action sensible.",
                ),
                robust=True,
            )
        user.save(update_fields=update_fields)

    return auth_method


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
                    "message": "Compte créé. Complétez maintenant les informations personnelles, puis vérifiez votre adresse email.",
                    "registration_token": signing.dumps(
                        {"user_id": user.pk}, salt=REGISTRATION_PROFILE_SALT
                    ),
                    "next_step": "complete_profile",
                    "profile_endpoint": "/api/auth/register/profile/",
                    "user": user_payload(user, request),
                },
                status=status.HTTP_201_CREATED,
            )
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class RegistrationProfileView(APIView):
    """Deuxième étape de l'inscription citoyenne.

    Le token signé retourné par POST /api/auth/register/ autorise uniquement
    la complétion des informations personnelles de ce compte. Il ne crée pas
    de session et ne remplace pas la vérification de l'adresse email.
    """

    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth"

    @registration_profile_post_schema
    def post(self, request):
        try:
            serializer = RegistrationProfileSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            user = serializer.save()
            return Response({
                "message": "Informations personnelles enregistrées.",
                "profile_completed": True,
                "next_step": "verify_email",
                "user": user_payload(user, request),
            })
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


@method_decorator(csrf_protect, name="dispatch")
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
            if user.mfa_enabled:
                mfa_token = issue_login_challenge(
                    user, remember=remember, auth_source="password"
                )
                return no_store(Response({
                    "mfa_required": True,
                    "mfa_token": mfa_token,
                    "methods": ["totp", "email", "recovery_code"],
                    "expires_in": settings.MFA_LOGIN_CHALLENGE_MAX_AGE,
                }))

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


@method_decorator(csrf_protect, name="dispatch")
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

                if created:
                    transaction.on_commit(lambda: send_welcome_email(user), robust=True)

            remember = serializer.validated_data.get(
                "remember", settings.AUTH_COOKIE_REMEMBER_DEFAULT
            )
            if user.mfa_enabled:
                mfa_token = issue_login_challenge(
                    user, remember=remember, auth_source="google"
                )
                return no_store(Response({
                    "created": False,
                    "mfa_required": True,
                    "mfa_token": mfa_token,
                    "methods": ["totp", "email", "recovery_code"],
                    "expires_in": settings.MFA_LOGIN_CHALLENGE_MAX_AGE,
                }))

            update_last_login(None, user)
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


@method_decorator(csrf_protect, name="dispatch")
class MFAVerifyLoginView(APIView):
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "mfa"

    @mfa_verify_login_post_schema
    def post(self, request):
        try:
            serializer = MFAVerifyLoginSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            try:
                challenge = load_login_challenge(serializer.validated_data["mfa_token"])
            except MFAError as exc:
                raise ValidationError({"mfa_token": str(exc)}) from exc

            with transaction.atomic():
                try:
                    user = User.objects.select_for_update().get(
                        pk=challenge["user_id"],
                        is_active=True,
                        email_verified=True,
                    )
                except (User.DoesNotExist, KeyError):
                    raise ValidationError({"mfa_token": "Challenge MFA invalide."})

                if not user.mfa_enabled or not user.mfa_login_nonce:
                    raise ValidationError({"mfa_token": "Challenge MFA invalide ou déjà utilisé."})
                if challenge.get("nonce") != user.mfa_login_nonce:
                    raise ValidationError({"mfa_token": "Ce challenge MFA n'est plus actif."})

                try:
                    if serializer.validated_data.get('email_code'):
                        from .services.security_otp import consume_otp
                        consume_otp(user, serializer.validated_data['email_challenge_id'],
                            serializer.validated_data['email_code'], 'login', challenge['nonce'])
                        method = 'email'
                    else:
                        method = verify_user_mfa(
                            user,
                            mfa_code=serializer.validated_data.get("mfa_code"),
                            recovery_code=serializer.validated_data.get("recovery_code"),
                        )
                except MFAError as exc:
                    raise ValidationError({"mfa": str(exc)}) from exc

                user.mfa_login_nonce = ""
                fields = ["mfa_login_nonce", "last_login", "updated_at"]
                if method == "totp":
                    fields.append("mfa_last_used_counter")
                elif method == 'recovery':
                    fields.append("mfa_recovery_codes")
                    transaction.on_commit(
                        lambda: send_security_alert(
                            user,
                            "Un code de récupération MFA a été utilisé lors d'une connexion.",
                        ),
                        robust=True,
                    )
                user.last_login = timezone.now()
                user.save(update_fields=fields)

                extra = {"mfa_verified": True}
                if challenge.get("auth_source") == "google":
                    extra["created"] = False
                return auth_response(
                    user,
                    request,
                    remember=bool(challenge.get("remember", settings.AUTH_COOKIE_REMEMBER_DEFAULT)),
                    extra=extra,
                )
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class MFAStatusView(APIView):
    permission_classes = [IsAuthenticatedAnyRole]

    @mfa_status_get_schema
    def get(self, request):
        user = request.user
        return Response({
            "enabled": user.mfa_enabled,
            "confirmed_at": user.mfa_confirmed_at,
            "recovery_codes_remaining": len(user.mfa_recovery_codes or []) if user.mfa_enabled else 0,
            "authenticator": "TOTP / Google Authenticator",
            "methods": ["totp", "email", "recovery_code"] if user.mfa_enabled else [],
        })


class MFASetupView(APIView):
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [IsAuthenticatedAnyRole]

    @mfa_setup_post_schema
    def post(self, request):
        try:
            serializer = MFASetupSerializer(data=request.data, context={"request": request})
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=request.user.pk)
                if user.mfa_enabled:
                    raise ValidationError({"mfa": "Le MFA est déjà activé sur ce compte."})
                verify_sensitive_action_identity(user, serializer.validated_data, require_mfa=False)
    
                secret = generate_totp_secret()
                user.mfa_secret_encrypted = encrypt_secret(secret)
                user.mfa_last_used_counter = None
                user.mfa_recovery_codes = []
                user.mfa_confirmed_at = None
                user.save(update_fields=[
                    "mfa_secret_encrypted", "mfa_last_used_counter",
                    "mfa_recovery_codes", "mfa_confirmed_at", "updated_at",
                ])
                uri = build_otpauth_uri(user, secret)
                return Response({
                    "message": "Scannez le QR code avec Google Authenticator puis confirmez avec un code à 6 chiffres.",
                    "secret": secret,
                    "otpauth_uri": uri,
                    "qr_code_data_url": qr_code_data_url(uri),
                    "algorithm": "SHA1",
                    "digits": 6,
                    "period": 30,
                })
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class MFAConfirmView(APIView):
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [IsAuthenticatedAnyRole]
    throttle_scope = "mfa"

    @mfa_confirm_post_schema
    def post(self, request):
        try:
            serializer = MFAConfirmSetupSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=request.user.pk)
                if user.mfa_enabled:
                    raise ValidationError({"mfa": "Le MFA est déjà activé."})
                try:
                    secret = decrypt_secret(user.mfa_secret_encrypted)
                except MFAError as exc:
                    raise ValidationError({"mfa": str(exc)}) from exc
                counter = verify_totp_secret(
                    secret,
                    serializer.validated_data["code"],
                    valid_window=settings.MFA_TOTP_VALID_WINDOW,
                )
                if counter is None:
                    raise ValidationError({"code": "Code Google Authenticator invalide ou expiré."})
                recovery_codes = mark_mfa_enabled(user, secret=secret)
                transaction.on_commit(
                    lambda: send_security_alert(
                        user,
                        "L'authentification multifacteur (Google Authenticator) a été activée sur votre compte.",
                    ),
                    robust=True,
                )

            response = Response({
                "message": "MFA activé. Enregistrez immédiatement les codes de récupération dans un endroit sûr.",
                "recovery_codes": recovery_codes,
                "recovery_codes_remaining": len(recovery_codes),
                "requires_relogin": True,
            })
            clear_refresh_cookie(response)
            return no_store(response)
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class MFADisableView(APIView):
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [IsAuthenticatedAnyRole]

    @mfa_disable_post_schema
    def post(self, request):
        try:
            serializer = MFADisableSerializer(data=request.data, context={"request": request})
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=request.user.pk)
                if not user.mfa_enabled:
                    raise ValidationError({"mfa": "Le MFA n'est pas activé."})
                verify_sensitive_action_identity(user, serializer.validated_data, require_mfa=True)
                clear_mfa(user)
                transaction.on_commit(
                    lambda: send_security_alert(
                        user,
                        "L'authentification multifacteur a été désactivée sur votre compte.",
                    ),
                    robust=True,
                )
            response = Response({"message": "MFA désactivé.", "requires_relogin": True})
            clear_refresh_cookie(response)
            return no_store(response)
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


class MFARecoveryCodesRegenerateView(APIView):
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    permission_classes = [IsAuthenticatedAnyRole]

    @mfa_recovery_regenerate_post_schema
    def post(self, request):
        try:
            serializer = MFARecoveryCodesRegenerateSerializer(
                data=request.data, context={"request": request}
            )
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=request.user.pk)
                if not user.mfa_enabled:
                    raise ValidationError({"mfa": "Le MFA n'est pas activé."})
                verify_sensitive_action_identity(user, serializer.validated_data, require_mfa=True)
                recovery_codes, hashes = generate_recovery_codes()
                user.mfa_recovery_codes = hashes
                user.save(update_fields=["mfa_recovery_codes", "updated_at"])
                transaction.on_commit(
                    lambda: send_security_alert(
                        user,
                        "De nouveaux codes de récupération MFA ont été générés. Les anciens codes ne sont plus valides.",
                    ),
                    robust=True,
                )
            return Response({
                "message": "Nouveaux codes de récupération générés.",
                "recovery_codes": recovery_codes,
                "recovery_codes_remaining": len(recovery_codes),
            })
        except APIException:
            raise
        except Exception as exc:
            return server_error(exc, self.__class__.__name__)


from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect


@method_decorator(csrf_protect, name="dispatch")
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
                    token = RefreshToken(refresh_value)
                    from .models import AccountSession
                    from .services.sessions import revoke_session
                    session = AccountSession.objects.filter(pk=token.get('sid'), user_id=token['user_id']).first() if token.get('sid') else None
                    if session:
                        revoke_session(session, 'logout')
                    token.blacklist()
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


@method_decorator(csrf_protect, name="dispatch")
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
                from .services.sessions import rotate_refresh
                refresh_data = rotate_refresh(refresh_value)
            except (TokenError, AuthenticationFailed):
                response = Response(
                    {"detail": "Session expirée. Reconnectez-vous."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
                clear_refresh_cookie(response)
                return no_store(response)

            rotated_refresh = refresh_data.get("refresh", refresh_value)
            response = Response(
                {"access": refresh_data["access"]},
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
                from .services.sessions import revoke_all
                revoke_all(user, "password_change")
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
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=request.user.pk)
                verify_sensitive_action_identity(user, serializer.validated_data)
                user.set_password(serializer.validated_data["new_password"])
                if user.google_sub:
                    user.auth_provider = User.AuthProvider.HYBRID
                user.save(update_fields=["password", "auth_provider", "updated_at"])
                from .services.sessions import revoke_all
                revoke_all(user, "password_change")
                update_session_auth_hash(request, user)
                transaction.on_commit(
                    lambda: send_password_changed_email(user), robust=True
                )
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
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=request.user.pk)
                verify_sensitive_action_identity(user, serializer.validated_data)
                user.set_password(serializer.validated_data["new_password"])
                user.auth_provider = User.AuthProvider.HYBRID if user.google_sub else User.AuthProvider.LOCAL
                user.save(update_fields=["password", "auth_provider", "updated_at"])
                from .services.sessions import revoke_all
                revoke_all(user, "password_change")
                transaction.on_commit(
                    lambda: send_password_changed_email(user), robust=True
                )
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
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=request.user.pk)
                verify_sensitive_action_identity(user, serializer.validated_data)
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
                from .services.sessions import revoke_all
                revoke_all(user, 'email_change')
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
                user = User.objects.select_for_update().get(pk=request.user.pk)
                verify_sensitive_action_identity(user, serializer.validated_data)
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
