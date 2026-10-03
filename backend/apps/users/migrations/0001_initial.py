# Generated for the initial custom user model.
import django.contrib.auth.models
import apps.users.managers
import django.contrib.auth.validators
import django.utils.timezone
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="User",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("password", models.CharField(max_length=128, verbose_name="password")),
                ("last_login", models.DateTimeField(blank=True, null=True, verbose_name="last login")),
                ("is_superuser", models.BooleanField(default=False, help_text="Designates that this user has all permissions without explicitly assigning them.", verbose_name="superuser status")),
                ("first_name", models.CharField(blank=True, max_length=150, verbose_name="first name")),
                ("last_name", models.CharField(blank=True, max_length=150, verbose_name="last name")),
                ("is_staff", models.BooleanField(default=False, help_text="Designates whether the user can log into this admin site.", verbose_name="staff status")),
                ("is_active", models.BooleanField(default=True, help_text="Designates whether this user should be treated as active. Unselect this instead of deleting accounts.", verbose_name="active")),
                ("date_joined", models.DateTimeField(default=django.utils.timezone.now, verbose_name="date joined")),
                ("email", models.EmailField(max_length=254, unique=True, verbose_name="adresse email")),
                ("phone_number", models.CharField(blank=True, max_length=32, verbose_name="téléphone")),
                ("avatar", models.ImageField(blank=True, null=True, upload_to="users/avatars/%Y/%m/", verbose_name="photo de profil")),
                ("avatar_url", models.URLField(blank=True, verbose_name="photo distante")),
                ("google_sub", models.CharField(blank=True, max_length=255, null=True, unique=True, verbose_name="Google subject")),
                ("auth_provider", models.CharField(choices=[("local", "Email / mot de passe"), ("google", "Google"), ("hybrid", "Email + Google")], default="local", max_length=16, verbose_name="méthode d'authentification")),
                ("email_verified", models.BooleanField(default=False, verbose_name="email vérifié")),
                ("locale", models.CharField(blank=True, default="fr", max_length=12)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("groups", models.ManyToManyField(blank=True, help_text="The groups this user belongs to. A user will get all permissions granted to each of their groups.", related_name="user_set", related_query_name="user", to="auth.group", verbose_name="groups")),
                ("user_permissions", models.ManyToManyField(blank=True, help_text="Specific permissions for this user.", related_name="user_set", related_query_name="user", to="auth.permission", verbose_name="user permissions")),
            ],
            options={"verbose_name": "utilisateur", "verbose_name_plural": "utilisateurs", "db_table": "users", "ordering": ("-date_joined",)},
            managers=[("objects", apps.users.managers.UserManager())],
        ),
    ]
