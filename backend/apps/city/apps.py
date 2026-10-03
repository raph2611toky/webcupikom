from django.apps import AppConfig


class CityConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.city"
    verbose_name = "Terra Nova"

    def ready(self):
        # Enregistre les checks de cohérence de déploiement.
        from . import checks  # noqa: F401
