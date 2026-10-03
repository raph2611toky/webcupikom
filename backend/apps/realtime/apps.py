from django.apps import AppConfig


class RealtimeConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.realtime"
    verbose_name = "Temps réel"

    def ready(self):
        # Les signaux ne changent jamais la logique métier. Ils publient uniquement
        # des invalidations/événements best-effort vers le channel layer.
        from . import signals  # noqa: F401
