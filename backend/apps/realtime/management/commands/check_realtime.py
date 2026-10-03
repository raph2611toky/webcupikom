from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.realtime.redis_client import sync_redis_client


class Command(BaseCommand):
    help = "Vérifie Redis et le channel layer WebSocket sans modifier les données métier."

    def handle(self, *args, **options):
        if not settings.REALTIME_ENABLED:
            self.stdout.write(self.style.WARNING("REALTIME_ENABLED=False : l'API HTTP reste active."))
            return
        try:
            pong = sync_redis_client().ping()
            if not pong:
                raise RuntimeError("PING Redis sans réponse positive")
            layer = get_channel_layer()
            async_to_sync(layer.group_send)(
                "rt.healthcheck",
                {
                    "type": "realtime_event",
                    "event": "healthcheck",
                    "event_id": "healthcheck",
                    "occurred_at": "",
                    "version": 1,
                    "payload": {},
                },
            )
        except Exception as exc:
            raise CommandError(f"Temps réel indisponible : {exc}") from exc
        self.stdout.write(self.style.SUCCESS("Redis + channel layer : OK"))
