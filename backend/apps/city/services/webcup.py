import logging

import requests
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from ..models import WebCupRequestSnapshot, WebCupSyncState

logger = logging.getLogger(__name__)

CACHE_KEY = "webcup:requests:payload:v1"


class WebCupUpstreamError(Exception):
    pass


class WebCupConfigurationError(WebCupUpstreamError):
    pass


def _as_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value != 0
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _as_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _nullable_int(value):
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _snapshot_defaults(item):
    return {
        "external_id": _nullable_int(item.get("id")),
        "requester_name": str(item.get("requester_name") or ""),
        "requester_type": str(item.get("requester_type") or ""),
        "message_public": str(item.get("message_public") or ""),
        "difficulty": str(item.get("difficulty") or ""),
        "difficulty_level": _as_int(item.get("difficulty_level")),
        "xp_base": _as_int(item.get("xp_base")),
        "xp_time_bonus": _as_int(item.get("xp_time_bonus")),
        "xp_total": _as_int(item.get("xp_total")),
        "xp_available": _as_int(item.get("xp_available")),
        "is_ai_related": _as_bool(item.get("is_ai_related")),
        "arrival_type": str(item.get("arrival_type") or ""),
        "wave_number": _nullable_int(item.get("wave_number")),
        "arrival_time": str(item.get("arrival_time") or ""),
        "group_name": str(item.get("group_name") or ""),
        "sort_order": _as_int(item.get("sort_order")),
        "is_initial": _as_bool(item.get("is_initial")),
        "is_ai_request": _as_bool(item.get("is_ai_request")),
        "visible_since_wave": _as_int(item.get("visible_since_wave")),
        "is_visible": True,
        "raw_payload": item,
    }


def _fallback_payload(error_message):
    state = WebCupSyncState.objects.filter(key="requests").first()
    snapshots = list(
        WebCupRequestSnapshot.objects.filter(is_visible=True)
        .order_by("sort_order", "external_id", "request_code")
    )
    if not state or not snapshots:
        raise WebCupUpstreamError(error_message)

    return {
        "api_version": state.api_version or "1.0",
        "session": state.session or {},
        "requests": [snapshot.raw_payload for snapshot in snapshots],
        "meta": {
            "source": "local_cache",
            "upstream_available": False,
            "new_request_codes": [],
            "synced_at": state.last_success_at.isoformat() if state.last_success_at else None,
            "warning": "Le flux WebCup est temporairement indisponible. Dernière copie locale renvoyée.",
        },
    }


def get_webcup_requests(*, force=False):
    if not force:
        cached = cache.get(CACHE_KEY)
        if cached:
            return cached

    api_url = settings.WEBCUP_REQUESTS_URL
    api_key = settings.WEBCUP_API_KEY
    if not api_url or not api_key:
        return _fallback_payload("WEBCUP_REQUESTS_URL ou WEBCUP_API_KEY n'est pas configuré.")

    try:
        response = requests.get(
            api_url,
            params={"api_key": api_key},
            headers={
                "Accept": "application/json",
                "User-Agent": "IKOM-Terra-Nova/1.0",
            },
            timeout=settings.WEBCUP_REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("Flux WebCup indisponible: %s", exc)
        try:
            state, _ = WebCupSyncState.objects.get_or_create(key="requests")
            state.last_error = str(exc)[:2000]
            state.save(update_fields=["last_error", "updated_at"])
        except Exception:
            logger.exception("Impossible d'enregistrer l'erreur de synchronisation WebCup")
        return _fallback_payload("Impossible de joindre l'API WebCup.")

    requests_payload = payload.get("requests")
    session_payload = payload.get("session")
    if not isinstance(requests_payload, list) or not isinstance(session_payload, dict):
        return _fallback_payload("Réponse WebCup invalide.")

    request_codes = [
        str(item.get("request_code") or "").strip()
        for item in requests_payload
        if isinstance(item, dict) and str(item.get("request_code") or "").strip()
    ]
    known_codes = set(
        WebCupRequestSnapshot.objects.filter(request_code__in=request_codes)
        .values_list("request_code", flat=True)
    )
    new_codes = [code for code in request_codes if code not in known_codes]
    now = timezone.now()

    with transaction.atomic():
        WebCupRequestSnapshot.objects.update(is_visible=False)
        for item in requests_payload:
            if not isinstance(item, dict):
                continue
            code = str(item.get("request_code") or "").strip()
            if not code:
                continue
            WebCupRequestSnapshot.objects.update_or_create(
                request_code=code,
                defaults=_snapshot_defaults(item),
            )

        WebCupSyncState.objects.update_or_create(
            key="requests",
            defaults={
                "api_version": str(payload.get("api_version") or "1.0"),
                "session": session_payload,
                "last_success_at": now,
                "last_error": "",
            },
        )

    result = {
        "api_version": payload.get("api_version", "1.0"),
        "session": session_payload,
        "requests": requests_payload,
        "meta": {
            "source": "webcup",
            "upstream_available": True,
            "new_request_codes": new_codes,
            "synced_at": now.isoformat(),
        },
    }
    cache.set(CACHE_KEY, result, settings.WEBCUP_CACHE_SECONDS)
    return result
