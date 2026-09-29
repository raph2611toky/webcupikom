import secrets
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.core import signing
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token


GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_STATE_SALT = "users.google.oauth.state"


class GoogleIdentityError(Exception):
    pass


def verify_google_credential(credential: str) -> dict:
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleIdentityError("GOOGLE_CLIENT_ID n'est pas configuré sur le serveur.")
    try:
        payload = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except Exception as exc:
        raise GoogleIdentityError("Jeton Google invalide ou expiré.") from exc

    if not payload.get("sub") or not payload.get("email"):
        raise GoogleIdentityError("Le compte Google ne fournit pas les informations requises.")
    if not payload.get("email_verified", False):
        raise GoogleIdentityError("L'adresse email Google n'est pas vérifiée.")
    return payload


def build_google_authorization_url() -> tuple[str, str]:
    """Construit une URL OAuth Google et un state signé, sans dépendre d'une session navigateur."""
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleIdentityError("GOOGLE_CLIENT_ID n'est pas configuré sur le serveur.")
    if not settings.GOOGLE_REDIRECT_URI:
        raise GoogleIdentityError("GOOGLE_REDIRECT_URI n'est pas configuré sur le serveur.")

    state = signing.dumps(
        {"nonce": secrets.token_urlsafe(32)},
        salt=GOOGLE_STATE_SALT,
        compress=True,
    )
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "include_granted_scopes": "true",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTHORIZATION_ENDPOINT}?{urlencode(params)}", state


def verify_google_state(state: str) -> None:
    try:
        signing.loads(
            state,
            salt=GOOGLE_STATE_SALT,
            max_age=settings.GOOGLE_OAUTH_STATE_MAX_AGE,
        )
    except (signing.BadSignature, signing.SignatureExpired) as exc:
        raise GoogleIdentityError("State Google invalide ou expiré.") from exc


def exchange_google_authorization_code(code: str, state: str) -> dict:
    """Échange le code OAuth contre un ID token, puis vérifie ce dernier."""
    verify_google_state(state)

    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleIdentityError("GOOGLE_CLIENT_ID n'est pas configuré sur le serveur.")
    if not settings.GOOGLE_CLIENT_SECRET:
        raise GoogleIdentityError("GOOGLE_CLIENT_SECRET n'est pas configuré sur le serveur.")
    if not settings.GOOGLE_REDIRECT_URI:
        raise GoogleIdentityError("GOOGLE_REDIRECT_URI n'est pas configuré sur le serveur.")

    try:
        response = requests.post(
            GOOGLE_TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            timeout=10,
        )
        response.raise_for_status()
        token_data = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise GoogleIdentityError("Impossible d'échanger le code d'autorisation Google.") from exc

    credential = token_data.get("id_token")
    if not credential:
        raise GoogleIdentityError("Google n'a pas retourné d'ID token.")
    return verify_google_credential(credential)
