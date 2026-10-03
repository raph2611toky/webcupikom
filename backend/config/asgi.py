"""ASGI entrypoint HTTP + WebSocket pour Terra Nova.

Le protocole HTTP conserve exactement l'application Django existante. Le canal
WebSocket est une couche optionnelle séparée et protégée par validation Origin +
ticket éphémère.
"""
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from django.core.asgi import get_asgi_application

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import OriginValidator
from django.conf import settings

from apps.realtime.routing import websocket_urlpatterns

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": OriginValidator(
            URLRouter(websocket_urlpatterns),
            settings.REALTIME_ALLOWED_ORIGINS,
        ),
    }
)
