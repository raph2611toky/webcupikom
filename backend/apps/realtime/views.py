from __future__ import annotations

from drf_yasg import openapi
from django.conf import settings
from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from helpers.permissions import IsAuthenticatedAnyRole

from .redis_client import sync_redis_client
from .tickets import InvalidRealtimeTicket, RealtimeUnavailable, issue_ticket


class RealtimeTicketView(APIView):
    """Échange l'auth HTTP existante contre un ticket WebSocket à usage unique."""

    permission_classes = [IsAuthenticatedAnyRole]
    throttle_scope = "realtime_ticket"

    @swagger_auto_schema(
        operation_summary="Créer un ticket WebSocket court et à usage unique",
        operation_description=(
            "L'API HTTP reste la source de vérité. Ce ticket expire rapidement et sert "
            "uniquement au handshake de /ws/realtime/. Le JWT principal n'est pas placé "
            "dans l'URL du WebSocket."
        ),
        request_body=openapi.Schema(type=openapi.TYPE_OBJECT, properties={}),
        responses={
            201: openapi.Response(
                "Ticket créé",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        "ticket": openapi.Schema(type=openapi.TYPE_STRING),
                        "expires_in": openapi.Schema(type=openapi.TYPE_INTEGER),
                        "websocket_path": openapi.Schema(type=openapi.TYPE_STRING),
                        "optional": openapi.Schema(type=openapi.TYPE_BOOLEAN),
                    },
                ),
            ),
            503: "Temps réel temporairement indisponible ; continuer via HTTP.",
        },
    )
    def post(self, request):
        try:
            ticket, ttl = issue_ticket(user=request.user, auth_token=request.auth)
        except InvalidRealtimeTicket as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_401_UNAUTHORIZED)
        except RealtimeUnavailable:
            return Response(
                {
                    "detail": "Temps réel temporairement indisponible.",
                    "realtime_available": False,
                    "http_fallback": True,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(
            {
                "ticket": ticket,
                "expires_in": ttl,
                "websocket_path": f"/ws/realtime/?ticket={ticket}",
                "optional": True,
                "http_fallback": True,
            },
            status=status.HTTP_201_CREATED,
        )


class RealtimeStatusView(APIView):
    permission_classes = [IsAuthenticatedAnyRole]
    throttle_scope = "realtime_ticket"

    @swagger_auto_schema(
        operation_summary="État non sensible de la couche temps réel",
        responses={200: "État WebSocket/Redis. Aucune information de connexion Redis n'est exposée."},
    )
    def get(self, request):
        backend = getattr(settings, "REALTIME_BACKEND_RESOLVED", "redis")
        available = False
        if settings.REALTIME_ENABLED and backend == "memory":
            available = True
        elif settings.REALTIME_ENABLED and backend == "redis":
            try:
                available = bool(sync_redis_client().ping())
            except Exception:
                available = False
        return Response(
            {
                "enabled": bool(settings.REALTIME_ENABLED and backend != "off"),
                "available": available,
                "transport": backend,
                "single_process_only": backend == "memory",
                "websocket_path": "/ws/realtime/",
                "ticket_endpoint": "/api/realtime/ticket/",
                "http_fallback": True,
            }
        )
