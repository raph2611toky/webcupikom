from __future__ import annotations

from .sessions import request_ip
from ..models import SecurityEvent


def record_security_event(*, user, kind, request=None, details=None, actor=None, session_id=None):
    """Trace non-secrète d'une action sensible du compte (F69).

    Ne jamais passer mot de passe, OTP, token, cookie, secret MFA ou credential
    dans ``details``. La fonction n'enregistre que le contexte minimal utile à
    un audit de sécurité.
    """
    payload = dict(details or {})
    if request is not None:
        payload.setdefault("ip_address", request_ip(request))
        payload.setdefault("method", request.method)
        payload.setdefault("path", request.path[:255])
        ua = (request.META.get("HTTP_USER_AGENT") or "")[:255]
        if ua:
            payload.setdefault("user_agent", ua)

    if session_id is None and request is not None:
        token = getattr(request, "auth", None)
        try:
            session_id = token.get("sid") if token else None
        except AttributeError:
            session_id = None

    return SecurityEvent.objects.create(
        actor=actor or user,
        subject=user,
        kind=str(kind)[:64],
        session_id=session_id,
        details=payload,
    )
