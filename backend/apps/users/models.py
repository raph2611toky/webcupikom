from django.contrib.auth.models import AbstractUser
from django.db import models

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
