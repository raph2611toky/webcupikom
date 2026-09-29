from django.contrib.auth.models import AbstractUser
from django.db import models

from .managers import UserManager


class User(AbstractUser):
    class AuthProvider(models.TextChoices):
        LOCAL = "local", "Email / mot de passe"
        GOOGLE = "google", "Google"
        HYBRID = "hybrid", "Email + Google"

    username = None
    email = models.EmailField("adresse email", unique=True)
    phone_number = models.CharField("téléphone", max_length=32, blank=True)
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
        super().save(*args, **kwargs)
