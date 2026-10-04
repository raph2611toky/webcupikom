from rest_framework.throttling import SimpleRateThrottle


class SensitiveMutationRateThrottle(SimpleRateThrottle):
    """F69 — limite toutes les mutations API, même sans throttle_scope dédié.

    La clé inclut la classe de vue afin de ne pas pénaliser l'usage normal
    lorsque plusieurs fonctionnalités légitimes sont utilisées à la suite.
    Les endpoints déjà dotés d'un ScopedRateThrottle conservent en plus leur
    limite spécialisée (auth, MFA, feedback, contact, etc.).
    """

    scope = "f69_sensitive_write"
    SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

    def allow_request(self, request, view):
        if request.method in self.SAFE_METHODS or not request.path.startswith("/api/"):
            return True
        return super().allow_request(request, view)

    def get_cache_key(self, request, view):
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            ident = f"u:{user.pk}"
        else:
            ident = f"ip:{self.get_ident(request)}"
        view_name = view.__class__.__name__
        return self.cache_format % {
            "scope": self.scope,
            "ident": f"{ident}:{view_name}",
        }

class SensitiveReadRateThrottle(SimpleRateThrottle):
    """F69 — borne la lecture répétée des espaces privés/sensibles."""

    scope = "f69_sensitive_read"
    SENSITIVE_PREFIXES = (
        "/api/account/",
        "/api/admin/",
        "/api/agent/",
        "/api/citizen/",
    )

    def allow_request(self, request, view):
        if request.method not in {"GET", "HEAD"}:
            return True
        if not request.path.startswith(self.SENSITIVE_PREFIXES):
            return True
        return super().allow_request(request, view)

    def get_cache_key(self, request, view):
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            ident = f"u:{user.pk}"
        else:
            ident = f"ip:{self.get_ident(request)}"
        return self.cache_format % {
            "scope": self.scope,
            "ident": f"{ident}:{view.__class__.__name__}",
        }
