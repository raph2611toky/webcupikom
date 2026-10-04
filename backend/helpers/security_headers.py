from __future__ import annotations


class APISecurityHeadersMiddleware:
    """F69 — ajoute des en-têtes défensifs aux réponses API.

    Les politiques très restrictives (Referrer-Policy et CSP) restent limitées
    aux routes /api/. Les pages HTML Django, notamment /admin/, doivent conserver
    la politique définie par SecurityMiddleware afin de ne pas casser la
    validation CSRF des formulaires HTTPS.
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

        # En-têtes défensifs compatibles avec les pages HTML Django.
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("X-Permitted-Cross-Domain-Policies", "none")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)",
        )

        if path.startswith("/api/"):
            # Les endpoints API sont des réponses de données : politique stricte.
            response.headers["Referrer-Policy"] = "no-referrer"
            response.headers.setdefault(
                "Content-Security-Policy",
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
            )
        else:
            # IMPORTANT : les formulaires HTML Django (/admin/ notamment) doivent
            # conserver une origine exploitable. Avec `no-referrer`, les navigateurs
            # peuvent envoyer `Origin: null` lors d'un POST de formulaire, ce que
            # CsrfViewMiddleware refuse. On force donc explicitement same-origin,
            # indépendamment d'une ancienne variable d'environnement cPanel.
            response.headers["Referrer-Policy"] = "same-origin"

        if path.startswith(self.SENSITIVE_PREFIXES):
            # Empêche les caches navigateur/proxy de conserver les données de
            # compte, d'administration API, d'agent ou d'authentification.
            response.headers["Cache-Control"] = "no-store, private, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        return response
