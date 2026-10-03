from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.users"
    verbose_name = "Utilisateurs et comptes"

    def ready(self):
        from . import middleware  # Register Django login security-version binding.
