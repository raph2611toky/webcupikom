from datetime import datetime, timezone as dt_timezone
from ipaddress import ip_address

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken

from ..models import AccountSession, User, SecurityEvent
from django.core.exceptions import ValidationError as DjangoValidationError


def _publish_realtime_security_event(*, user_id, event, session_id=None, reason=""):
    """Best-effort uniquement : une panne Redis ne touche jamais la révocation DB."""
    try:
        from apps.realtime.services import publish_after_commit, session_group, user_group

        groups = [session_group(session_id)] if session_id else [user_group(user_id)]
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


def create_session(user, refresh, request=None):
    session = AccountSession.objects.create(
        user=user, security_version=user.auth_token_version,
        refresh_jti=refresh['jti'],
        expires_at=datetime.fromtimestamp(refresh['exp'], tz=dt_timezone.utc),
        user_agent=(request.META.get('HTTP_USER_AGENT', '')[:512] if request else ''),
        ip_address=request_ip(request) if request else None,
    )
    SecurityEvent.objects.create(actor=user, subject=user, kind='session_created', session_id=session.pk)
    refresh['sid'] = str(session.pk)
    # for_user() persists the token before custom claims are added.
    from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
    OutstandingToken.objects.filter(jti=refresh['jti']).update(token=str(refresh))
    return session


def get_active_session(user, token, *, lock=False):
    sid = token.get('sid')
    if not sid:
        raise AuthenticationFailed('Reconnectez-vous pour sécuriser votre session.', code='token_revoked')
    queryset = AccountSession.objects.select_for_update() if lock else AccountSession.objects
    try:
        session = queryset.get(pk=sid, user=user, revoked_at__isnull=True,
                               expires_at__gt=timezone.now(), security_version=user.auth_token_version)
    except (AccountSession.DoesNotExist, ValueError, TypeError, DjangoValidationError):
        raise AuthenticationFailed('Session expirée ou révoquée.', code='token_revoked')
    if int(token.get('security_version', -1)) != user.auth_token_version:
        raise AuthenticationFailed('Session révoquée.', code='token_revoked')
    return session


def revoke_session(session, reason='user'):
    SecurityEvent.objects.create(subject=session.user, kind='session_revoked', session_id=session.pk, details={'reason': reason})
    AccountSession.objects.filter(pk=session.pk, revoked_at__isnull=True).update(
        revoked_at=timezone.now(), revoke_reason=reason)
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


def revoke_all(user, reason='security_change'):
    # Caller locks the user. Version prevents even tokens with no sid from surviving.
    SecurityEvent.objects.create(subject=user, kind='sessions_revoked', details={'reason': reason})
    user.auth_token_version += 1
    user.mfa_login_nonce = ''
    user.save(update_fields=['auth_token_version', 'mfa_login_nonce', 'updated_at'])
    AccountSession.objects.filter(user=user, revoked_at__isnull=True).update(
        revoked_at=timezone.now(), revoke_reason=reason)
    _publish_realtime_security_event(
        user_id=user.pk,
        event="security.sessions_revoked",
        reason=reason,
    )
    from .mfa import revoke_user_refresh_tokens
    revoke_user_refresh_tokens(user)


def rotate_refresh(value):
    from rest_framework_simplejwt.serializers import TokenRefreshSerializer
    token = RefreshToken(value)
    with transaction.atomic():
        try:
            user = User.objects.select_for_update().get(pk=token['user_id'], is_active=True)
        except User.DoesNotExist:
            raise AuthenticationFailed('Session invalide.')
        session = get_active_session(user, token, lock=True)
        if session.refresh_jti != token['jti']:
            raise AuthenticationFailed('Ce jeton de renouvellement a déjà été utilisé.')
        serializer = TokenRefreshSerializer(data={'refresh': value})
        serializer.is_valid(raise_exception=True)
        rotated = RefreshToken(serializer.validated_data.get('refresh', value))
        session.refresh_jti = rotated['jti']
        session.last_seen_at = timezone.now()
        session.expires_at = datetime.fromtimestamp(rotated['exp'], tz=dt_timezone.utc)
        session.save(update_fields=['refresh_jti', 'last_seen_at', 'expires_at'])
        return serializer.validated_data
