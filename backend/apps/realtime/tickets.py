from __future__ import annotations

import hashlib
import json
import secrets
import time

from django.conf import settings

from .redis_client import async_redis_client, sync_redis_client


class RealtimeUnavailable(RuntimeError):
    pass


class InvalidRealtimeTicket(ValueError):
    pass


def _ticket_key(token: str) -> str:
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return f"{settings.REALTIME_REDIS_PREFIX}:ticket:{digest}"


def issue_ticket(*, user, auth_token) -> tuple[str, int]:
    """Crée un ticket opaque, court et à usage unique dans Redis.

    Le JWT principal n'est jamais copié dans Redis ni envoyé dans l'URL du
    WebSocket. Seuls les identifiants nécessaires à la revalidation DB sont
    conservés pendant quelques secondes.
    """
    if not settings.REALTIME_ENABLED:
        raise RealtimeUnavailable("Le service temps réel est désactivé.")

    sid = str(auth_token.get("sid") or "")
    if not sid:
        raise InvalidRealtimeTicket("La session courante ne peut pas ouvrir de canal temps réel.")

    ttl = settings.REALTIME_TICKET_TTL
    token = secrets.token_urlsafe(32)
    payload = {
        "user_id": user.pk,
        "sid": sid,
        "security_version": int(user.auth_token_version),
        "issued_at": int(time.time()),
    }
    try:
        created = sync_redis_client().set(
            _ticket_key(token),
            json.dumps(payload, separators=(",", ":")),
            ex=ttl,
            nx=True,
        )
    except Exception as exc:  # Redis indisponible => temps réel indisponible, pas HTTP.
        raise RealtimeUnavailable("Redis temps réel indisponible.") from exc
    if not created:
        raise RealtimeUnavailable("Impossible de créer le ticket temps réel.")
    return token, ttl


async def consume_ticket(token: str) -> dict:
    if not token or len(token) > 256:
        raise InvalidRealtimeTicket("Ticket temps réel invalide.")
    if not settings.REALTIME_ENABLED:
        raise RealtimeUnavailable("Le service temps réel est désactivé.")

    client = async_redis_client()
    try:
        # GET + DEL atomique compatible Redis >=5 (EVAL est également requis
        # par RedisChannelLayer). Un ticket capturé ne peut donc pas être rejoué.
        value = await client.eval(
            "local v=redis.call('GET',KEYS[1]); if v then redis.call('DEL',KEYS[1]); end; return v",
            1,
            _ticket_key(token),
        )
    except Exception as exc:
        raise RealtimeUnavailable("Redis temps réel indisponible.") from exc
    finally:
        await client.aclose()

    if not value:
        raise InvalidRealtimeTicket("Ticket temps réel expiré, inconnu ou déjà utilisé.")
    try:
        payload = json.loads(value)
    except (TypeError, json.JSONDecodeError) as exc:
        raise InvalidRealtimeTicket("Ticket temps réel corrompu.") from exc
    if not isinstance(payload, dict):
        raise InvalidRealtimeTicket("Ticket temps réel invalide.")
    return payload
