import hashlib
import re
import secrets
from datetime import datetime, timezone as dt_timezone
from ipaddress import ip_address

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken

from ..models import AccountDevice, AccountSession, SecurityEvent, User

_DEVICE_COOKIE_REQUEST_ATTR = "_account_device_cookie_value"
_DEVICE_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{32,128}$")


def _publish_realtime_security_event(*, user_id, event, session_id=None, reason="", broadcast_user=False):
    """Best-effort uniquement : une panne Redis ne touche jamais la révocation DB."""
    try:
        from apps.realtime.services import publish_after_commit, session_group, user_group

        groups = [user_group(user_id)] if broadcast_user else ([session_group(session_id)] if session_id else [user_group(user_id)])
        publish_after_commit(
            groups=groups,
            event=event,
            payload={
                "session_id": str(session_id) if session_id else None,
                "reason": reason,
                "reauthentication_required": True,
            },
        )
    except Exception:
        # La base et les JWT restent la source de vérité.
        return


def request_ip(request):
    # Never trust client-controlled X-Forwarded-For without a trusted proxy policy.
    try:
        return str(ip_address(request.META.get("REMOTE_ADDR", "")))
    except ValueError:
        return None


def _device_token_hash(user_id, raw_token):
    # Include the user id so the same browser token cannot correlate different accounts in DB.
    return hashlib.sha256(f"{user_id}:{raw_token}".encode("utf-8")).hexdigest()


def _device_label(user_agent):
    ua = (user_agent or "").lower()
    if "iphone" in ua or "ipad" in ua or "ios" in ua:
        platform = "iPhone / iPad"
    elif "android" in ua:
        platform = "Android"
    elif "windows" in ua:
        platform = "Windows"
    elif "macintosh" in ua or "mac os" in ua:
        platform = "macOS"
    elif "linux" in ua:
        platform = "Linux"
    else:
        platform = "Appareil inconnu"

    if "edg/" in ua or "edge/" in ua:
        browser = "Edge"
    elif "firefox/" in ua:
        browser = "Firefox"
    elif "chrome/" in ua or "crios/" in ua:
        browser = "Chrome"
    elif "safari/" in ua:
        browser = "Safari"
    else:
        browser = "Navigateur inconnu"
    return f"{browser} · {platform}"[:160]


def _resolve_account_device(user, request):
    """Resolve a durable browser/device without relying on IP as identity.

    The raw random token only lives in the HttpOnly cookie. The database stores a
    user-scoped SHA-256 hash so a database leak cannot reproduce the cookie and the
    same browser cannot be correlated across different accounts from this value.
    """
    cookie_name = getattr(settings, "AUTH_DEVICE_COOKIE_NAME", "kamo_device")
    raw_token = (request.COOKIES.get(cookie_name) or "").strip()
    if not _DEVICE_TOKEN_RE.fullmatch(raw_token):
        raw_token = secrets.token_urlsafe(32)

    token_hash = _device_token_hash(user.pk, raw_token)
    now = timezone.now()
    user_agent = (request.META.get("HTTP_USER_AGENT", "") or "")[:512]
    ip = request_ip(request)
    label = _device_label(user_agent)

    device, created = AccountDevice.objects.get_or_create(
        user=user,
        token_hash=token_hash,
        defaults={
            "label": label,
            "user_agent": user_agent,
            "last_seen_at": now,
            "last_login_at": now,
            "last_ip_address": ip,
        },
    )
    if not created:
        AccountDevice.objects.filter(pk=device.pk).update(
            label=label,
            user_agent=user_agent,
            last_seen_at=now,
            last_login_at=now,
            last_ip_address=ip,
        )
        device.label = label
        device.user_agent = user_agent
        device.last_seen_at = now
        device.last_login_at = now
        device.last_ip_address = ip

    # auth_response() will refresh/set this cookie after the transaction succeeds.
    setattr(request, _DEVICE_COOKIE_REQUEST_ATTR, raw_token)
    return device, created


def device_cookie_value_from_request(request):
    return getattr(request, _DEVICE_COOKIE_REQUEST_ATTR, None)


def _notify_new_device(*, user_id, session_id, device_id, device_label, ip):
    """Deliver F54 through independent channels; one failure must not break login."""
    user = User.objects.filter(pk=user_id, is_active=True).first()
    if user is None:
        return

    location_hint = f" Adresse IP observée : {ip}." if ip else ""
    message = (
        f"Une nouvelle connexion a été détectée depuis {device_label}."
        f"{location_hint} Si ce n’était pas vous, consultez vos sessions et révoquez immédiatement la connexion concernée."
    )

    try:
        from apps.city.models import CitizenNotification

        CitizenNotification.objects.get_or_create(
            user_id=user_id,
            notification_code=f"security:new-device:{session_id}",
            defaults={
                "scope": CitizenNotification.Scope.AUTOMATED,
                "kind": CitizenNotification.Kind.SYSTEM,
                "title": "Nouvelle connexion détectée",
                "message": message,
                "is_important": False,
            },
        )
    except Exception:
        # F54 email + SecurityEvent remain available even if the city notification layer is unavailable.
        pass

    try:
        from .account_emails import send_security_alert

        send_security_alert(user, message)
    except Exception:
        # A mail outage must never turn a valid login into HTTP 500.
        pass

    try:
        _publish_realtime_security_event(
            user_id=user_id,
            event="security.new_device_login",
            session_id=session_id,
            reason="new_device",
            broadcast_user=True,
        )
    except Exception:
        pass


def create_session(user, refresh, request=None):
    device = None
    is_new_device = False
    if request is not None:
        device, is_new_device = _resolve_account_device(user, request)

    session = AccountSession.objects.create(
        user=user,
        device=device,
        is_new_device_login=is_new_device,
        security_version=user.auth_token_version,
        refresh_jti=refresh["jti"],
        expires_at=datetime.fromtimestamp(refresh["exp"], tz=dt_timezone.utc),
        user_agent=(request.META.get("HTTP_USER_AGENT", "")[:512] if request else ""),
        ip_address=request_ip(request) if request else None,
    )
    details = {
        "device_id": str(device.pk) if device else None,
        "device_label": device.label if device else "",
        "new_device": bool(is_new_device),
        "ip_address": session.ip_address,
    }
    SecurityEvent.objects.create(
        actor=user,
        subject=user,
        kind="session_created",
        session_id=session.pk,
        details=details,
    )
    if is_new_device and device is not None:
        SecurityEvent.objects.create(
            actor=user,
            subject=user,
            kind="new_device_login",
            session_id=session.pk,
            details=details,
        )
        transaction.on_commit(
            lambda: _notify_new_device(
                user_id=user.pk,
                session_id=session.pk,
                device_id=device.pk,
                device_label=device.label,
                ip=session.ip_address,
            ),
            robust=True,
        )

    refresh["sid"] = str(session.pk)
    # for_user() persists the token before custom claims are added.
    from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

    OutstandingToken.objects.filter(jti=refresh["jti"]).update(token=str(refresh))
    return session


def get_active_session(user, token, *, lock=False):
    sid = token.get("sid")
    if not sid:
        raise AuthenticationFailed("Reconnectez-vous pour sécuriser votre session.", code="token_revoked")
    queryset = AccountSession.objects.select_for_update() if lock else AccountSession.objects
    try:
        session = queryset.get(
            pk=sid,
            user=user,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
            security_version=user.auth_token_version,
        )
    except (AccountSession.DoesNotExist, ValueError, TypeError, DjangoValidationError):
        raise AuthenticationFailed("Session expirée ou révoquée.", code="token_revoked")
    if int(token.get("security_version", -1)) != user.auth_token_version:
        raise AuthenticationFailed("Session révoquée.", code="token_revoked")
    return session


def revoke_session(session, reason="user"):
    SecurityEvent.objects.create(
        subject=session.user,
        kind="session_revoked",
        session_id=session.pk,
        details={"reason": reason},
    )
    AccountSession.objects.filter(pk=session.pk, revoked_at__isnull=True).update(
        revoked_at=timezone.now(), revoke_reason=reason
    )
    _publish_realtime_security_event(
        user_id=session.user_id,
        session_id=session.pk,
        event="security.session_revoked",
        reason=reason,
    )
    from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

    outstanding = OutstandingToken.objects.filter(jti=session.refresh_jti).first()
    if outstanding:
        BlacklistedToken.objects.get_or_create(token=outstanding)


def revoke_all(user, reason="security_change"):
    # Caller locks the user. Version prevents even tokens with no sid from surviving.
    SecurityEvent.objects.create(subject=user, kind="sessions_revoked", details={"reason": reason})
    user.auth_token_version += 1
    user.mfa_login_nonce = ""
    user.save(update_fields=["auth_token_version", "mfa_login_nonce", "updated_at"])
    AccountSession.objects.filter(user=user, revoked_at__isnull=True).update(
        revoked_at=timezone.now(), revoke_reason=reason
    )
    _publish_realtime_security_event(
        user_id=user.pk,
        event="security.sessions_revoked",
        reason=reason,
    )
    from .mfa import revoke_user_refresh_tokens

    revoke_user_refresh_tokens(user)


def rotate_refresh(value, request=None):
    from rest_framework_simplejwt.serializers import TokenRefreshSerializer

    token = RefreshToken(value)
    with transaction.atomic():
        try:
            user = User.objects.select_for_update().get(pk=token["user_id"], is_active=True)
        except User.DoesNotExist:
            raise AuthenticationFailed("Session invalide.")
        session = get_active_session(user, token, lock=True)
        if session.refresh_jti != token["jti"]:
            raise AuthenticationFailed("Ce jeton de renouvellement a déjà été utilisé.")
        serializer = TokenRefreshSerializer(data={"refresh": value})
        serializer.is_valid(raise_exception=True)
        rotated = RefreshToken(serializer.validated_data.get("refresh", value))
        now = timezone.now()
        session.refresh_jti = rotated["jti"]
        session.last_seen_at = now
        session.expires_at = datetime.fromtimestamp(rotated["exp"], tz=dt_timezone.utc)
        session.save(update_fields=["refresh_jti", "last_seen_at", "expires_at"])

        if request is not None and session.device_id:
            AccountDevice.objects.filter(pk=session.device_id).update(
                last_seen_at=now,
                last_ip_address=request_ip(request),
                user_agent=(request.META.get("HTTP_USER_AGENT", "") or "")[:512],
            )
        return serializer.validated_data
