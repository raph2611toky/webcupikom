"""MFA TOTP compatible Google Authenticator.

Le secret TOTP est chiffré au repos avec Fernet. Les codes de récupération ne
sont jamais stockés en clair : seul un HMAC côté serveur est conservé.
"""

import base64
import hashlib
import hmac
import io
import secrets
import struct
import time
from urllib.parse import quote

import qrcode
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core import signing
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken


MFA_LOGIN_CHALLENGE_SALT = "users.mfa.login.v1"
DEFAULT_DIGITS = 6
DEFAULT_PERIOD = 30
RECOVERY_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"


class MFAError(Exception):
    pass


def _fernet() -> Fernet:
    material = (getattr(settings, "MFA_ENCRYPTION_KEY", "") or settings.SECRET_KEY).encode("utf-8")
    key = base64.urlsafe_b64encode(hashlib.sha256(b"kamo:mfa:fernet:" + material).digest())
    return Fernet(key)


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode("ascii")).decode("ascii")


def decrypt_secret(value: str) -> str:
    if not value:
        raise MFAError("Aucun secret MFA n'est configuré.")
    try:
        return _fernet().decrypt(value.encode("ascii")).decode("ascii")
    except (InvalidToken, ValueError) as exc:
        raise MFAError("Le secret MFA enregistré ne peut pas être déchiffré.") from exc


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def _base32_decode(secret: str) -> bytes:
    normalized = secret.strip().replace(" ", "").upper()
    padding = "=" * ((8 - len(normalized) % 8) % 8)
    try:
        return base64.b32decode(normalized + padding, casefold=True)
    except Exception as exc:
        raise MFAError("Secret MFA invalide.") from exc


def totp_for_counter(secret: str, counter: int, *, digits: int = DEFAULT_DIGITS) -> str:
    key = _base32_decode(secret)
    payload = struct.pack(">Q", int(counter))
    digest = hmac.new(key, payload, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    binary = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(binary % (10 ** digits)).zfill(digits)


def verify_totp_secret(
    secret: str,
    code: str,
    *,
    last_used_counter: int | None = None,
    valid_window: int = 1,
    at_time: float | None = None,
) -> int | None:
    normalized = "".join(ch for ch in str(code) if ch.isdigit())
    if len(normalized) != DEFAULT_DIGITS:
        return None

    now = time.time() if at_time is None else at_time
    current_counter = int(now // DEFAULT_PERIOD)
    for offset in range(-valid_window, valid_window + 1):
        candidate_counter = current_counter + offset
        if candidate_counter < 0:
            continue
        if last_used_counter is not None and candidate_counter <= last_used_counter:
            continue
        expected = totp_for_counter(secret, candidate_counter)
        if hmac.compare_digest(expected, normalized):
            return candidate_counter
    return None


def build_otpauth_uri(user, secret: str) -> str:
    issuer = getattr(settings, "MFA_ISSUER", "") or getattr(settings, "SITE_NAME", "Kamo")
    label = f"{issuer}:{user.email}"
    return (
        f"otpauth://totp/{quote(label, safe='')}?"
        f"secret={secret}&issuer={quote(issuer, safe='')}&algorithm=SHA1&digits=6&period=30"
    )


def qr_code_data_url(otpauth_uri: str) -> str:
    qr = qrcode.QRCode(version=None, box_size=7, border=4)
    qr.add_data(otpauth_uri)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _recovery_pepper() -> bytes:
    material = (getattr(settings, "MFA_RECOVERY_PEPPER", "") or settings.SECRET_KEY).encode("utf-8")
    return hashlib.sha256(b"kamo:mfa:recovery:" + material).digest()


def normalize_recovery_code(code: str) -> str:
    allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return "".join(ch for ch in str(code).upper() if ch in allowed)


def hash_recovery_code(code: str) -> str:
    normalized = normalize_recovery_code(code)
    return hmac.new(_recovery_pepper(), normalized.encode("ascii"), hashlib.sha256).hexdigest()


def generate_recovery_codes(count: int = 10) -> tuple[list[str], list[str]]:
    plain_codes = []
    hashed_codes = []
    seen = set()
    while len(plain_codes) < count:
        raw = "".join(secrets.choice(RECOVERY_ALPHABET) for _ in range(12))
        if raw in seen:
            continue
        seen.add(raw)
        display = f"{raw[:4]}-{raw[4:8]}-{raw[8:]}"
        plain_codes.append(display)
        hashed_codes.append(hash_recovery_code(display))
    return plain_codes, hashed_codes


def consume_recovery_code(user, code: str) -> bool:
    candidate = hash_recovery_code(code)
    hashes = list(user.mfa_recovery_codes or [])
    for index, stored in enumerate(hashes):
        if hmac.compare_digest(stored, candidate):
            del hashes[index]
            user.mfa_recovery_codes = hashes
            return True
    return False


def verify_user_mfa(user, *, mfa_code: str | None = None, recovery_code: str | None = None) -> str:
    if not user.mfa_enabled:
        raise MFAError("Le MFA n'est pas activé sur ce compte.")
    if bool(mfa_code) == bool(recovery_code):
        raise MFAError("Fournissez soit un code Google Authenticator, soit un code de récupération.")

    if recovery_code:
        if not consume_recovery_code(user, recovery_code):
            raise MFAError("Code de récupération invalide ou déjà utilisé.")
        return "recovery"

    secret = decrypt_secret(user.mfa_secret_encrypted)
    counter = verify_totp_secret(
        secret,
        mfa_code,
        last_used_counter=user.mfa_last_used_counter,
        valid_window=getattr(settings, "MFA_TOTP_VALID_WINDOW", 1),
    )
    if counter is None:
        raise MFAError("Code Google Authenticator invalide, expiré ou déjà utilisé.")
    user.mfa_last_used_counter = counter
    return "totp"


def issue_login_challenge(user, *, remember: bool, auth_source: str) -> str:
    nonce = secrets.token_urlsafe(32)
    user.mfa_login_nonce = nonce
    user.save(update_fields=["mfa_login_nonce", "updated_at"])
    return signing.dumps(
        {
            "user_id": user.pk,
            "nonce": nonce,
            "remember": bool(remember),
            "auth_source": auth_source,
        },
        salt=MFA_LOGIN_CHALLENGE_SALT,
        compress=True,
    )


def load_login_challenge(token: str) -> dict:
    try:
        return signing.loads(
            token,
            salt=MFA_LOGIN_CHALLENGE_SALT,
            max_age=getattr(settings, "MFA_LOGIN_CHALLENGE_MAX_AGE", 300),
        )
    except signing.SignatureExpired as exc:
        raise MFAError("Le challenge MFA a expiré. Reconnectez-vous.") from exc
    except signing.BadSignature as exc:
        raise MFAError("Challenge MFA invalide.") from exc


def revoke_user_refresh_tokens(user) -> int:
    revoked = 0
    for token in OutstandingToken.objects.filter(user=user):
        _, created = BlacklistedToken.objects.get_or_create(token=token)
        if created:
            revoked += 1
    return revoked


def mark_mfa_enabled(user, *, secret: str) -> list[str]:
    recovery_codes, recovery_hashes = generate_recovery_codes()
    user.mfa_secret_encrypted = encrypt_secret(secret)
    user.mfa_enabled = True
    user.mfa_confirmed_at = timezone.now()
    # Le code utilisé pour confirmer l'installation n'est pas considéré comme
    # un code de connexion déjà consommé : l'utilisateur peut se reconnecter
    # immédiatement sans attendre le prochain cycle de 30 secondes.
    user.mfa_last_used_counter = None
    user.mfa_recovery_codes = recovery_hashes
    user.mfa_login_nonce = ""
    user.auth_token_version += 1
    user.save(update_fields=[
        "mfa_secret_encrypted",
        "mfa_enabled",
        "mfa_confirmed_at",
        "mfa_last_used_counter",
        "mfa_recovery_codes",
        "mfa_login_nonce",
        "auth_token_version",
        "updated_at",
    ])
    revoke_user_refresh_tokens(user)
    return recovery_codes


def clear_mfa(user) -> None:
    user.mfa_enabled = False
    user.mfa_secret_encrypted = ""
    user.mfa_recovery_codes = []
    user.mfa_confirmed_at = None
    user.mfa_last_used_counter = None
    user.mfa_login_nonce = ""
    user.auth_token_version += 1
    user.save(update_fields=[
        "mfa_enabled",
        "mfa_secret_encrypted",
        "mfa_recovery_codes",
        "mfa_confirmed_at",
        "mfa_last_used_counter",
        "mfa_login_nonce",
        "auth_token_version",
        "updated_at",
    ])
    revoke_user_refresh_tokens(user)
