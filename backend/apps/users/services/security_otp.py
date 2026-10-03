import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import Throttled, ValidationError

from ..models import SecurityOTP, SecurityRateBucket
from helpers.services.emails import send_templated_email


def digest(value):
    return hmac.new(settings.SECRET_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()


def rate_limit(key, limit, seconds):
    # Database-backed counters shared by all workers; no per-process cache dependence.
    now = timezone.now()
    with transaction.atomic():
        bucket, _ = SecurityRateBucket.objects.get_or_create(key=digest(key), defaults={'started_at': now})
        bucket = SecurityRateBucket.objects.select_for_update().get(pk=bucket.pk)
        if bucket.started_at <= now - timedelta(seconds=seconds):
            bucket.started_at, bucket.count = now, 0
        if bucket.count >= limit:
            raise Throttled(wait=max(1, seconds - int((now-bucket.started_at).total_seconds())))
        bucket.count += 1
        bucket.save(update_fields=['count', 'started_at'])


def issue_otp(user, purpose, binding):
    if not user.email_verified or not user.is_active:
        raise ValidationError('Une adresse email vérifiée est requise.')
    rate_limit(f'otp-send:{user.pk}', 3, 300)
    code = str(secrets.randbelow(1000000)).zfill(6)
    with transaction.atomic():
        SecurityOTP.objects.filter(user=user, purpose=purpose, binding=binding, used_at__isnull=True).update(used_at=timezone.now())
        otp = SecurityOTP.objects.create(user=user, purpose=purpose, binding=binding,
            email=user.email, security_version=user.auth_token_version,
            code_hash='', expires_at=timezone.now()+timedelta(minutes=5))
        otp.code_hash = digest(f'{otp.pk}:{code}')
        otp.save(update_fields=['code_hash'])
    # Sending failure is visible; no code is returned in the API.
    try:
        sent = send_templated_email(to=user.email, subject=f'Code de sécurité — {settings.SITE_NAME}',
            template_name='security_otp', context={'code': code, 'purpose': purpose})
        if not sent:
            raise RuntimeError('Email delivery failed')
    except Exception:
        SecurityOTP.objects.filter(pk=otp.pk).update(used_at=timezone.now())
        raise
    return otp


def reserve_attempt(challenge_id, user_id):
    from django.db.models import F
    try:
        updated = SecurityOTP.objects.filter(pk=challenge_id, user_id=user_id, used_at__isnull=True,
            expires_at__gt=timezone.now(), attempts__lt=5).update(attempts=F('attempts')+1)
    except (ValueError, TypeError, ValidationError, DjangoValidationError):
        updated = 0
    if not updated:
        raise ValidationError({'email_challenge_id': 'Code expiré, épuisé ou déjà utilisé.'})


def consume_otp(user, challenge_id, code, purpose, binding):
    try:
        otp = SecurityOTP.objects.select_for_update().get(pk=challenge_id, user=user,
            purpose=purpose, binding=binding, email=user.email,
            security_version=user.auth_token_version, used_at__isnull=True,
            expires_at__gt=timezone.now(), attempts__lte=5)
    except (SecurityOTP.DoesNotExist, ValueError, TypeError, DjangoValidationError):
        raise ValidationError({'email_code': 'Code invalide, expiré ou déjà utilisé.'})
    if not hmac.compare_digest(otp.code_hash, digest(f'{otp.pk}:{code}')):
        raise ValidationError({'email_code': 'Code invalide.'})
    otp.used_at = timezone.now()
    otp.save(update_fields=['used_at'])
