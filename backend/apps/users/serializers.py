from django.contrib.auth import authenticate, password_validation
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers

from .models import User
from .services.account_emails import CHANGE_EMAIL_SALT
from .tokens import email_verification_token


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    avatar_display_url = serializers.SerializerMethodField()
    has_password = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "email", "first_name", "last_name", "display_name", "role",
            "phone_number", "avatar", "avatar_url", "avatar_display_url",
            "auth_provider", "email_verified", "locale", "has_password",
            "date_joined", "updated_at",
        )
        read_only_fields = (
            "id", "email", "display_name", "role", "avatar_display_url", "auth_provider",
            "email_verified", "avatar_url", "has_password", "date_joined", "updated_at",
        )

    def get_display_name(self, obj):
        return obj.get_full_name().strip() or obj.email

    def get_avatar_display_url(self, obj):
        if obj.avatar:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.avatar.url) if request else obj.avatar.url
        return obj.avatar_url or None

    def get_has_password(self, obj):
        return obj.has_usable_password()


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Champs réellement modifiables du profil via multipart/form-data."""

    class Meta:
        model = User
        fields = ("first_name", "last_name", "phone_number", "avatar", "locale")
        extra_kwargs = {
            "first_name": {"required": False},
            "last_name": {"required": False},
            "phone_number": {"required": False},
            "avatar": {"required": False, "allow_null": True},
            "locale": {"required": False},
        }


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, min_length=8)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = User
        fields = ("email", "password", "password_confirm", "first_name", "last_name")

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cette adresse email.")
        return email

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Les mots de passe ne correspondent pas."})
        password_validation.validate_password(attrs["password"])
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class AgentRegisterSerializer(RegisterSerializer):
    """Inscription d'un agent municipal avec le même parcours qu'un citoyen.

    Le rôle n'est jamais accepté depuis la requête : il est forcé côté serveur.
    """

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(
            password=password,
            role=User.Role.AGENT,
            **validated_data,
        )


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    remember = serializers.BooleanField(required=False)

    def validate(self, attrs):
        email = attrs["email"].strip().lower()
        user = authenticate(request=self.context.get("request"), email=email, password=attrs["password"])
        if not user:
            raise serializers.ValidationError("Email ou mot de passe incorrect.")
        if not user.is_active:
            raise serializers.ValidationError("Ce compte est désactivé.")
        if not user.email_verified:
            raise serializers.ValidationError({"email": "Adresse email non vérifiée."})
        attrs["user"] = user
        return attrs


class GoogleAuthSerializer(serializers.Serializer):
    remember = serializers.BooleanField(required=False)
    credential = serializers.CharField(
        required=False,
        allow_blank=False,
        trim_whitespace=False,
        help_text="ID token Google Identity Services. Utiliser soit credential, soit code + state.",
    )
    code = serializers.CharField(
        required=False,
        allow_blank=False,
        trim_whitespace=False,
        help_text="Code OAuth retourné par Google après redirection.",
    )
    state = serializers.CharField(
        required=False,
        allow_blank=False,
        trim_whitespace=False,
        help_text="State retourné par Google, obtenu initialement via GET /api/auth/google/redirect/.",
    )

    def validate(self, attrs):
        credential = attrs.get("credential")
        code = attrs.get("code")
        state = attrs.get("state")

        if credential and (code or state):
            raise serializers.ValidationError(
                "Utilisez soit 'credential', soit le couple 'code' + 'state', jamais les deux flux en même temps."
            )
        if credential:
            return attrs
        if code and state:
            return attrs
        raise serializers.ValidationError(
            "Fournissez 'credential' ou bien les deux champs 'code' et 'state'."
        )


class EmailOnlySerializer(serializers.Serializer):
    email = serializers.EmailField()


class VerifyEmailSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()

    def validate(self, attrs):
        try:
            user_id = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(pk=user_id)
        except (ValueError, TypeError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError("Lien de vérification invalide.")
        if user.email_verified:
            attrs["user"] = user
            attrs["already_verified"] = True
            return attrs
        if not email_verification_token.check_token(user, attrs["token"]):
            raise serializers.ValidationError("Lien de vérification invalide ou expiré.")
        attrs["user"] = user
        attrs["already_verified"] = False
        return attrs


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        if attrs["new_password"] != attrs.pop("new_password_confirm"):
            raise serializers.ValidationError({"new_password_confirm": "Les mots de passe ne correspondent pas."})
        try:
            user_id = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(pk=user_id, is_active=True)
        except (ValueError, TypeError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError("Lien de réinitialisation invalide.")
        if not default_token_generator.check_token(user, attrs["token"]):
            raise serializers.ValidationError("Lien de réinitialisation invalide ou expiré.")
        password_validation.validate_password(attrs["new_password"], user)
        attrs["user"] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.has_usable_password():
            raise serializers.ValidationError("Ce compte n'a pas encore de mot de passe local. Utilisez l'endpoint set-password.")
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": "Mot de passe actuel incorrect."})
        if attrs["new_password"] != attrs.pop("new_password_confirm"):
            raise serializers.ValidationError({"new_password_confirm": "Les mots de passe ne correspondent pas."})
        password_validation.validate_password(attrs["new_password"], user)
        return attrs


class SetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = self.context["request"].user
        if user.has_usable_password():
            raise serializers.ValidationError("Un mot de passe existe déjà. Utilisez change-password.")
        if attrs["new_password"] != attrs.pop("new_password_confirm"):
            raise serializers.ValidationError({"new_password_confirm": "Les mots de passe ne correspondent pas."})
        password_validation.validate_password(attrs["new_password"], user)
        return attrs


class ChangeEmailRequestSerializer(serializers.Serializer):
    new_email = serializers.EmailField()
    current_password = serializers.CharField(write_only=True, trim_whitespace=False, required=False, allow_blank=True)

    def validate_new_email(self, value):
        email = value.strip().lower()
        user = self.context["request"].user
        if email == user.email:
            raise serializers.ValidationError("Cette adresse est déjà celle du compte.")
        if User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("Cette adresse email est déjà utilisée.")
        return email

    def validate(self, attrs):
        user = self.context["request"].user
        if user.has_usable_password() and not user.check_password(attrs.get("current_password", "")):
            raise serializers.ValidationError({"current_password": "Mot de passe actuel incorrect."})
        return attrs


class ChangeEmailConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(trim_whitespace=False)

    def validate(self, attrs):
        try:
            data = signing.loads(
                attrs["token"],
                salt=CHANGE_EMAIL_SALT,
                max_age=60 * 60 * 24,
            )
            user = User.objects.get(pk=data["user_id"], is_active=True)
            new_email = data["new_email"].strip().lower()
        except (signing.BadSignature, signing.SignatureExpired, KeyError, User.DoesNotExist):
            raise serializers.ValidationError("Lien de changement d'email invalide ou expiré.")
        if User.objects.filter(email__iexact=new_email).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("Cette adresse email est déjà utilisée.")
        attrs["user"] = user
        attrs["new_email"] = new_email
        return attrs


class DeleteAccountSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False, required=False, allow_blank=True)
    confirmation = serializers.CharField(help_text='Saisir exactement "DELETE".')

    def validate(self, attrs):
        user = self.context["request"].user
        if attrs.get("confirmation") != "DELETE":
            raise serializers.ValidationError({"confirmation": 'Saisissez exactement "DELETE".'})
        if user.has_usable_password() and not user.check_password(attrs.get("current_password", "")):
            raise serializers.ValidationError({"current_password": "Mot de passe actuel incorrect."})
        return attrs


class RefreshRequestSerializer(serializers.Serializer):
    refresh = serializers.CharField()
