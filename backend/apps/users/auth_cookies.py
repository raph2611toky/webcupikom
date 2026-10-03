from django.conf import settings
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken


def build_refresh_token(user, *, remember: bool) -> RefreshToken:
    """Create a signed refresh token and persist the remember preference as a JWT claim."""
    refresh = RefreshToken.for_user(user)
    refresh["remember"] = bool(remember)
    refresh["security_version"] = int(user.auth_token_version)
    return refresh


def remember_from_refresh(refresh_value: str) -> bool:
    refresh = RefreshToken(refresh_value)
    return bool(refresh.get("remember", settings.AUTH_COOKIE_REMEMBER_DEFAULT))


def get_refresh_cookie(request) -> str:
    return (request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME) or "").strip()


def set_refresh_cookie(response: Response, refresh_value: str, *, remember: bool) -> None:
    options = {
        "httponly": True,
        "secure": settings.AUTH_REFRESH_COOKIE_SECURE,
        "samesite": settings.AUTH_REFRESH_COOKIE_SAMESITE,
        "path": settings.AUTH_REFRESH_COOKIE_PATH,
    }
    if settings.AUTH_REFRESH_COOKIE_DOMAIN:
        options["domain"] = settings.AUTH_REFRESH_COOKIE_DOMAIN
    if remember:
        options["max_age"] = settings.AUTH_REFRESH_COOKIE_MAX_AGE

    response.set_cookie(
        settings.AUTH_REFRESH_COOKIE_NAME,
        refresh_value,
        **options,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        settings.AUTH_REFRESH_COOKIE_NAME,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
        domain=settings.AUTH_REFRESH_COOKIE_DOMAIN or None,
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
    )


def no_store(response: Response) -> Response:
    response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response["Pragma"] = "no-cache"
    return response
