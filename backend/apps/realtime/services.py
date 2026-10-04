from __future__ import annotations

import logging
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from decimal import Decimal

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="realtime-publish")
_slots = threading.BoundedSemaphore(value=max(1, settings.REALTIME_EMIT_QUEUE_MAX))
_log_lock = threading.Lock()
_last_warning = {}


def _warn_limited(key, message, *args, exc_info=False):
    now = time.monotonic()
    with _log_lock:
        if now - _last_warning.get(key, 0.0) < 30.0:
            return
        _last_warning[key] = now
    logger.warning(message, *args, exc_info=exc_info)


def user_group(user_id) -> str:
    return f"rt.user.{int(user_id)}"


def role_group(role: str) -> str:
    safe = role if role in {"citizen", "agent", "admin"} else "unknown"
    return f"rt.role.{safe}"


def staff_group() -> str:
    return "rt.staff"


def session_group(session_id) -> str:
    return f"rt.session.{str(session_id)}"


def resource_group(resource_type: str, pk) -> str:
    allowed = {"request", "appointment", "contact"}
    if resource_type not in allowed:
        raise ValueError("Type de ressource temps réel non autorisé.")
    return f"rt.{resource_type}.{int(pk)}"


def _json_safe(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    return value


def _send(groups, envelope):
    if sys.is_finalizing():
        return
    try:
        layer = get_channel_layer()
        if layer is None:
            return
        sender = async_to_sync(layer.group_send)
        for group in groups:
            sender(group, {"type": "realtime_event", **envelope})
    except Exception:
        # Le temps réel est explicitement best-effort : une panne Redis ne doit
        # jamais transformer une mutation HTTP réussie en erreur métier.
        _warn_limited(
            "channel_layer",
            "Publication temps réel ignorée (channel layer indisponible).",
            exc_info=True,
        )


def publish_event(*, groups, event: str, payload=None, event_id=None):
    if not settings.REALTIME_ENABLED or sys.is_finalizing():
        return False
    normalized_groups = tuple(dict.fromkeys(g for g in groups if g))
    if not normalized_groups:
        return False
    envelope = {
        "event": str(event)[:120],
        "event_id": event_id or uuid.uuid4().hex,
        "occurred_at": timezone.now().isoformat(),
        "version": 1,
        "payload": _json_safe(payload or {}),
    }
    if not _slots.acquire(blocking=False):
        _warn_limited(
            "queue_full",
            "File de publication temps réel saturée : des événements sont temporairement abandonnés.",
        )
        return False

    try:
        future = _executor.submit(_send, normalized_groups, envelope)
    except RuntimeError:
        # Cas typique d'une commande manage.py qui termine : l'interpréteur
        # ferme déjà ses pools de threads. Ce n'est pas une erreur métier.
        _slots.release()
        return False
    future.add_done_callback(lambda _future: _slots.release())
    return True


def publish_event_now(*, groups, event: str, payload=None, event_id=None):
    """Publication synchrone avec résultat explicite.

    À réserver aux événements qui disposent d'une source durable en base
    (notamment l'outbox des signalements urgents). Une panne Redis renvoie
    ``False`` au lieu de faire perdre silencieusement l'événement.
    """
    if not settings.REALTIME_ENABLED or sys.is_finalizing():
        return False
    normalized_groups = tuple(dict.fromkeys(g for g in groups if g))
    if not normalized_groups:
        return False
    envelope = {
        "event": str(event)[:120],
        "event_id": event_id or uuid.uuid4().hex,
        "occurred_at": timezone.now().isoformat(),
        "version": 1,
        "payload": _json_safe(payload or {}),
    }
    try:
        layer = get_channel_layer()
        if layer is None:
            return False
        sender = async_to_sync(layer.group_send)
        for group in normalized_groups:
            sender(group, {"type": "realtime_event", **envelope})
        return True
    except Exception:
        _warn_limited(
            "channel_layer_sync",
            "Publication temps réel durable non livrée ; elle restera dans l'outbox.",
            exc_info=True,
        )
        return False


def publish_after_commit(*, groups, event: str, payload=None, event_id=None):
    groups = tuple(groups)
    payload = _json_safe(payload or {})
    transaction.on_commit(
        lambda: publish_event(groups=groups, event=event, payload=payload, event_id=event_id),
        robust=True,
    )
