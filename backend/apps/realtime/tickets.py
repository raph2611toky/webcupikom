from __future__ import annotations

import hashlib
import json
import secrets
import threading
import time

from django.conf import settings

from .redis_client import async_redis_client, sync_redis_client


class RealtimeUnavailable(RuntimeError):
    pass


class InvalidRealtimeTicket(ValueError):
    pass


# En mode mémoire, les tickets restent opaques, courts et à usage unique.
# Ils ne sont valables que dans le processus Uvicorn courant, ce qui correspond
# au mode local sans Redis. La production multi-worker doit utiliser Redis.
_memory_tickets: dict[str, tuple[float, dict]] = {}
_memory_lock = threading.Lock()


def _ticket_key(token: str) -> str:
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return f"{settings.REALTIME_REDIS_PREFIX}:ticket:{digest}"


def _resolved_backend() -> str:
    return getattr(settings, "REALTIME_BACKEND_RESOLVED", "redis")


def _prune_memory_tickets(now: float) -> None:
    expired = [key for key, (expires_at, _payload) in _memory_tickets.items() if expires_at <= now]
    for key in expired:
        _memory_tickets.pop(key, None)


def issue_ticket(*, user, auth_token) -> tuple[str, int]:
    """Crée un ticket WebSocket opaque, court et à usage unique.

    Redis est utilisé en production lorsqu'il est disponible. En mode local
    ``memory``, le ticket est conservé quelques secondes en mémoire du processus.
    Le JWT principal n'est jamais placé dans l'URL du WebSocket.
    """
    backend = _resolved_backend()
    if not settings.REALTIME_ENABLED or backend == "off":
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

    if backend == "memory":
        now = time.monotonic()
        with _memory_lock:
            _prune_memory_tickets(now)
            _memory_tickets[_ticket_key(token)] = (now + ttl, payload)
        return token, ttl

    try:
        created = sync_redis_client().set(
            _ticket_key(token),
            json.dumps(payload, separators=(",", ":")),
            ex=ttl,
            nx=True,
        )
    except Exception as exc:
        raise RealtimeUnavailable("Redis temps réel indisponible.") from exc
    if not created:
        raise RealtimeUnavailable("Impossible de créer le ticket temps réel.")
    return token, ttl


async def consume_ticket(token: str) -> dict:
    if not token or len(token) > 256:
        raise InvalidRealtimeTicket("Ticket temps réel invalide.")

    backend = _resolved_backend()
    if not settings.REALTIME_ENABLED or backend == "off":
        raise RealtimeUnavailable("Le service temps réel est désactivé.")

    if backend == "memory":
        now = time.monotonic()
        with _memory_lock:
            _prune_memory_tickets(now)
            stored = _memory_tickets.pop(_ticket_key(token), None)
        if not stored:
            raise InvalidRealtimeTicket("Ticket temps réel expiré, inconnu ou déjà utilisé.")
        expires_at, payload = stored
        if expires_at <= now:
            raise InvalidRealtimeTicket("Ticket temps réel expiré, inconnu ou déjà utilisé.")
        return dict(payload)

    client = async_redis_client()
    try:
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
