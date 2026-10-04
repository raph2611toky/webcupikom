from __future__ import annotations

from django.conf import settings


class APISecurityHeadersMiddleware:
    """F69 — ajoute des en-têtes défensifs aux réponses API.

    Le middleware reste volontairement neutre vis-à-vis du frontend : pas de
    CSP globale sur Django Admin/Swagger, seulement sur /api/ où les réponses
    sont des données et non des pages applicatives.
    """

    SENSITIVE_PREFIXES = (
        "/api/account/",
        "/api/admin/",
        "/api/agent/",
        "/api/citizen/",
        "/api/auth/",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        path = request.path or ""

        # Défense en profondeur. SecurityMiddleware/XFrameOptionsMiddleware
        # conservent leur rôle ; ces valeurs rendent la politique API explicite.
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Permitted-Cross-Domain-Policies", "none")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)",
        )

        if path.startswith("/api/"):
            # Les endpoints API ne doivent pas être embarqués comme documents.
            response.headers.setdefault(
                "Content-Security-Policy",
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
            )

        if path.startswith(self.SENSITIVE_PREFIXES):
            # Empêche les caches navigateur/proxy de conserver les données de
            # compte, d'administration, d'agent ou les réponses d'authentification.
            response.headers["Cache-Control"] = "no-store, private, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        return response
