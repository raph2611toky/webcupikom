from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid

from .managers import UserManager


class User(AbstractUser):
    class Role(models.TextChoices):
        CITIZEN = "citizen", "Citoyen"
        AGENT = "agent", "Agent municipal"
        ADMIN = "admin", "Administrateur"

    class AuthProvider(models.TextChoices):
        LOCAL = "local", "Email / mot de passe"
        GOOGLE = "google", "Google"
        HYBRID = "hybrid", "Email + Google"

    class Gender(models.TextChoices):
        FEMALE = "female", "Femme"
        MALE = "male", "Homme"
        OTHER = "other", "Autre"
        PREFER_NOT_TO_SAY = "prefer_not_to_say", "Préfère ne pas répondre"

    username = None
    email = models.EmailField("adresse email", unique=True)
    role = models.CharField("rôle", max_length=16, choices=Role.choices, default=Role.CITIZEN)
    phone_number = models.CharField("téléphone", max_length=32, blank=True)
    profession = models.CharField("profession", max_length=120, blank=True)
    gender = models.CharField("sexe / genre", max_length=24, choices=Gender.choices, blank=True)
    birth_date = models.DateField("date de naissance", null=True, blank=True)
    address = models.CharField("adresse", max_length=255, blank=True)
    habitat = models.CharField("habitat", max_length=120, blank=True)
    district = models.CharField("quartier / district", max_length=120, blank=True)
    sector = models.CharField("secteur", max_length=120, blank=True)
    street = models.CharField("rue", max_length=160, blank=True)
    building = models.CharField("bâtiment", max_length=120, blank=True)
    apartment = models.CharField("appartement", max_length=80, blank=True)
    registration_profile_completed_at = models.DateTimeField(
        "profil d'inscription complété le", null=True, blank=True
    )
    avatar = models.ImageField("photo de profil", upload_to="users/avatars/%Y/%m/", blank=True, null=True)
    avatar_url = models.URLField("photo distante", blank=True)
    google_sub = models.CharField("Google subject", max_length=255, unique=True, blank=True, null=True)
    auth_provider = models.CharField(
        "méthode d'authentification",
        max_length=16,
        choices=AuthProvider.choices,
        default=AuthProvider.LOCAL,
    )
    email_verified = models.BooleanField("email vérifié", default=False)
    mfa_enabled = models.BooleanField("MFA activé", default=False)
    mfa_secret_encrypted = models.TextField("secret MFA chiffré", blank=True, default="")
    mfa_recovery_codes = models.JSONField("codes de récupération MFA", default=list, blank=True)
    mfa_confirmed_at = models.DateTimeField("MFA confirmé le", null=True, blank=True)
    mfa_last_used_counter = models.BigIntegerField("dernier compteur TOTP utilisé", null=True, blank=True)
    mfa_login_nonce = models.CharField("nonce de challenge MFA", max_length=128, blank=True, default="")
    auth_token_version = models.PositiveIntegerField("version de sécurité JWT", default=0)
    locale = models.CharField(max_length=12, blank=True, default="fr")
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        db_table = "users"
        verbose_name = "utilisateur"
        verbose_name_plural = "utilisateurs"
        ordering = ("-date_joined",)

    def __str__(self):
        return self.get_full_name().strip() or self.email

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.strip().lower()
        if self.is_superuser:
            self.role = self.Role.ADMIN
        self.is_staff = self.role == self.Role.ADMIN
        super().save(*args, **kwargs)


class AccountDevice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="account_devices")
    token_hash = models.CharField(max_length=64)
    label = models.CharField(max_length=160, blank=True)
    user_agent = models.CharField(max_length=512, blank=True)
    first_seen_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now_add=True)
    last_login_at = models.DateTimeField(auto_now_add=True)
    last_ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ("-last_login_at",)
        constraints = [
            models.UniqueConstraint(fields=["user", "token_hash"], name="unique_account_device_token"),
        ]
        indexes = [models.Index(fields=["user", "last_seen_at"], name="users_accdev_user_seen_idx")]

    def __str__(self):
        return f"{self.user_id} — {self.label or 'Appareil'}"


class AccountSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="account_sessions")
    device = models.ForeignKey(
        AccountDevice, on_delete=models.SET_NULL, null=True, blank=True, related_name="sessions"
    )
    is_new_device_login = models.BooleanField(default=False)
    security_version = models.PositiveIntegerField(default=0)
    refresh_jti = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoke_reason = models.CharField(max_length=80, blank=True)
    user_agent = models.CharField(max_length=512, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["user", "revoked_at"])]

    def __str__(self):
        state = "révoquée" if self.revoked_at else "active"
        return f"{self.user.email} — session {str(self.id)[:8]} ({state})"


class SecurityOTP(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    purpose = models.CharField(max_length=24)
    binding = models.CharField(max_length=255)
    email = models.EmailField()
    security_version = models.PositiveIntegerField()
    code_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True)
    attempts = models.PositiveSmallIntegerField(default=0)

    def __str__(self):
        return f"{self.user.email} — OTP {self.purpose}"


class SecurityRateBucket(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    started_at = models.DateTimeField()
    count = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.key} — {self.count}"


class SecurityEvent(models.Model):
    actor = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name='security_actions')
    subject = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name='security_events')
    kind = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    session_id = models.UUIDField(null=True)
    details = models.JSONField(default=dict)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        target = self.subject or self.actor
        return f"{self.kind} — {target or 'système'}"
