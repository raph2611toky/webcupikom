import os
import sys
from datetime import timedelta
from pathlib import Path
from urllib.parse import quote, urlencode

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


SECRET_KEY = os.getenv("SECRET_KEY", "django-insecure-change-me")
DEBUG = env_bool("MODE_DEV", env_bool("DEBUG", True))

ALLOWED_HOSTS = env_list(
    "ALLOWED_HOSTS",
    "api.ikomholala.madagascar.webcup.hodi.cloud,127.0.0.1,localhost",
)

LOCAL_APPS = [
    "apps.users.apps.UsersConfig",
    "apps.city.apps.CityConfig",
    "apps.realtime.apps.RealtimeConfig",
]
THIRD_APPS = [
    "channels",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "drf_yasg",
]

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    *LOCAL_APPS,
    *THIRD_APPS,
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "helpers.security_headers.APISecurityHeadersMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.users.middleware.DjangoSessionSecurityMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

if os.getenv("DB_NAME"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": os.getenv("DB_NAME"),
            "USER": os.getenv("DB_USER"),
            "PASSWORD": os.getenv("DB_PASSWORD"),
            "HOST": os.getenv("DB_HOST", "localhost"),
            "PORT": os.getenv("DB_PORT", "3306"),
            "OPTIONS": {
                "charset": "utf8mb4",
                # Mode strict côté connexion Django pour éviter les insertions
                # tronquées/silencieuses et supprimer mysql.W002.
                "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
            },
        }
    }
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}

# Sur les hébergements mutualisés, l'utilisateur MariaDB n'a souvent pas le
# droit CREATE DATABASE. Les tests Django utilisent donc SQLite par défaut et
# ne touchent jamais à la base de production. Mettre TEST_USE_SQLITE=False
# uniquement si un serveur de test MariaDB dédié est configuré.
if "test" in sys.argv and env_bool("TEST_USE_SQLITE", True):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTH_USER_MODEL = "users.User"
AUTHENTICATION_BACKENDS = ["django.contrib.auth.backends.ModelBackend"]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.users.authentication.VersionedJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["helpers.permissions.IsAuthenticatedAnyRole"],
    "EXCEPTION_HANDLER": "helpers.api_exception_handler.custom_exception_handler",
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_CLASSES": [
        "helpers.throttles.SensitiveMutationRateThrottle",
        "helpers.throttles.SensitiveReadRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "auth": os.getenv("THROTTLE_AUTH", "20/min"),
        "auth_email": os.getenv("THROTTLE_AUTH_EMAIL", "5/min"),
        "mfa": os.getenv("THROTTLE_MFA", "10/min"),
        "password_reset": os.getenv("THROTTLE_PASSWORD_RESET", "5/min"),
        "sensitive_account": os.getenv("THROTTLE_SENSITIVE_ACCOUNT", "10/min"),
        "contact": os.getenv("THROTTLE_CONTACT", "10/min"),
        "webcup": os.getenv("THROTTLE_WEBCUP", "60/min"),
        "realtime_ticket": os.getenv("THROTTLE_REALTIME_TICKET", "12/min"),
        "citizen_participation": os.getenv("THROTTLE_CITIZEN_PARTICIPATION", "30/min"),
        "service_feedback": os.getenv("THROTTLE_SERVICE_FEEDBACK", "10/hour"),
        "privacy_concern": os.getenv("THROTTLE_PRIVACY_CONCERN", "5/hour"),
        "f69_sensitive_write": os.getenv("THROTTLE_F69_SENSITIVE_WRITE", "30/min"),
        "f69_sensitive_read": os.getenv("THROTTLE_F69_SENSITIVE_READ", "120/min"),
    },
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ],
}

JWT_ACCESS_MINUTES = int(os.getenv("JWT_ACCESS_MINUTES", "15"))
JWT_REFRESH_DAYS = int(os.getenv("JWT_REFRESH_DAYS", "30"))
JWT_SIGNING_KEY = os.getenv("JWT_SIGNING_KEY", SECRET_KEY)

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=JWT_ACCESS_MINUTES),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=JWT_REFRESH_DAYS),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "CHECK_REVOKE_TOKEN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "SIGNING_KEY": JWT_SIGNING_KEY,
}

# Le refresh token reste uniquement dans un cookie HttpOnly. La clé de signature
# JWT_SIGNING_KEY est un secret backend et ne doit jamais être exposée via VITE_*.
AUTH_REFRESH_COOKIE_NAME = os.getenv("AUTH_REFRESH_COOKIE_NAME", "kamo_refresh")
AUTH_REFRESH_COOKIE_SECURE = env_bool("AUTH_REFRESH_COOKIE_SECURE", not DEBUG)
AUTH_REFRESH_COOKIE_SAMESITE = os.getenv("AUTH_REFRESH_COOKIE_SAMESITE", "Lax").strip() or "Lax"
AUTH_REFRESH_COOKIE_DOMAIN = os.getenv("AUTH_REFRESH_COOKIE_DOMAIN", "").strip() or None
AUTH_REFRESH_COOKIE_PATH = os.getenv("AUTH_REFRESH_COOKIE_PATH", "/api/auth/").strip() or "/api/auth/"
AUTH_REFRESH_COOKIE_MAX_AGE = int(
    os.getenv("AUTH_REFRESH_COOKIE_MAX_AGE", str(JWT_REFRESH_DAYS * 24 * 60 * 60))
)
AUTH_COOKIE_REMEMBER_DEFAULT = env_bool("AUTH_COOKIE_REMEMBER_DEFAULT", True)

# F54 — identifiant opaque de navigateur/appareil. Le cookie ne contient ni
# email, ni user id, ni empreinte matérielle ; seule une valeur aléatoire HttpOnly
# est conservée côté navigateur et son hash user-scoped côté base.
AUTH_DEVICE_COOKIE_NAME = os.getenv("AUTH_DEVICE_COOKIE_NAME", "kamo_device")
AUTH_DEVICE_COOKIE_SECURE = env_bool("AUTH_DEVICE_COOKIE_SECURE", AUTH_REFRESH_COOKIE_SECURE)
AUTH_DEVICE_COOKIE_SAMESITE = os.getenv("AUTH_DEVICE_COOKIE_SAMESITE", AUTH_REFRESH_COOKIE_SAMESITE).strip() or "Lax"
AUTH_DEVICE_COOKIE_DOMAIN = os.getenv("AUTH_DEVICE_COOKIE_DOMAIN", "").strip() or AUTH_REFRESH_COOKIE_DOMAIN
AUTH_DEVICE_COOKIE_PATH = os.getenv("AUTH_DEVICE_COOKIE_PATH", "/api/auth/").strip() or "/api/auth/"
AUTH_DEVICE_COOKIE_MAX_AGE = int(os.getenv("AUTH_DEVICE_COOKIE_MAX_AGE", str(365 * 24 * 60 * 60)))

SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", not DEBUG)
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", not DEBUG)
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_SAMESITE = os.getenv("CSRF_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_NAME = "csrftoken"
CSRF_COOKIE_PATH = "/"
CSRF_COOKIE_HTTPONLY = False

CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_SAMESITE = os.getenv("CSRF_COOKIE_SAMESITE", "Lax")

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = env_bool("USE_X_FORWARDED_HOST", True)
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", False)
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = os.getenv("SECURE_REFERRER_POLICY", "same-origin")
SECURE_CROSS_ORIGIN_OPENER_POLICY = os.getenv("SECURE_CROSS_ORIGIN_OPENER_POLICY", "same-origin")
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "0" if DEBUG else "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", not DEBUG)
SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", False)
X_FRAME_OPTIONS = "DENY"

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Indian/Antananarivo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "statics"]
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "https://ikomholala.madagascar.webcup.hodi.cloud,https://api.ikomholala.madagascar.webcup.hodi.cloud,http://localhost:5173",
)
CORS_ALLOW_ALL_ORIGINS = env_bool("CORS_ALLOW_ALL_ORIGINS", False)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_PRIVATE_NETWORK = env_bool("CORS_ALLOW_PRIVATE_NETWORK", False)
CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    "https://ikomholala.madagascar.webcup.hodi.cloud,https://api.ikomholala.madagascar.webcup.hodi.cloud,http://localhost:5173",
)

SITE_NAME = os.getenv("SITE_NAME", "Administration")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "support@example.com")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI",
    f"{FRONTEND_URL.rstrip('/')}/auth/google/callback",
)
GOOGLE_OAUTH_STATE_MAX_AGE = int(os.getenv("GOOGLE_OAUTH_STATE_MAX_AGE", "600"))


# -----------------------------------------------------------------------------
# Temps réel / WebSocket (optionnel)
# -----------------------------------------------------------------------------
REALTIME_ENABLED = env_bool("REALTIME_ENABLED", True)
REALTIME_REDIS_DB = int(os.getenv("REALTIME_REDIS_DB", "15"))
REALTIME_REDIS_PREFIX = os.getenv("REALTIME_REDIS_PREFIX", "terra_nova_rt").strip() or "terra_nova_rt"
REALTIME_REDIS_CONNECT_TIMEOUT = float(os.getenv("REALTIME_REDIS_CONNECT_TIMEOUT", "0.35"))
REALTIME_REDIS_SOCKET_TIMEOUT = float(os.getenv("REALTIME_REDIS_SOCKET_TIMEOUT", "0.75"))


def _realtime_redis_url():
    explicit = os.getenv("REALTIME_REDIS_URL", "").strip()
    if explicit:
        return explicit

    password = os.getenv("REDIS_PASSWORD", "").strip()
    socket_path = os.getenv("REDIS_SOCKET", "").strip()
    if socket_path:
        query = {"db": REALTIME_REDIS_DB}
        if password:
            query["password"] = password
        return f"unix://{quote(socket_path, safe='/')}?{urlencode(query)}"

    host = os.getenv("REDIS_HOST", "127.0.0.1").strip() or "127.0.0.1"
    port = int(os.getenv("REDIS_PORT", "6379"))
    auth = f":{quote(password, safe='')}@" if password else ""
    return f"redis://{auth}{host}:{port}/{REALTIME_REDIS_DB}"


REALTIME_REDIS_URL = _realtime_redis_url()
REALTIME_TICKET_TTL = max(10, min(int(os.getenv("REALTIME_TICKET_TTL", "30")), 120))
REALTIME_SESSION_RECHECK_SECONDS = max(15, int(os.getenv("REALTIME_SESSION_RECHECK_SECONDS", "45")))
REALTIME_MAX_MESSAGE_BYTES = max(1024, int(os.getenv("REALTIME_MAX_MESSAGE_BYTES", "8192")))
REALTIME_MAX_CLIENT_MESSAGES_PER_MINUTE = max(10, int(os.getenv("REALTIME_MAX_CLIENT_MESSAGES_PER_MINUTE", "60")))
REALTIME_MAX_RESOURCE_SUBSCRIPTIONS = max(1, int(os.getenv("REALTIME_MAX_RESOURCE_SUBSCRIPTIONS", "20")))
REALTIME_EMIT_QUEUE_MAX = max(20, int(os.getenv("REALTIME_EMIT_QUEUE_MAX", "500")))
REALTIME_ALLOWED_ORIGINS = env_list(
    "REALTIME_ALLOWED_ORIGINS",
    ",".join(CORS_ALLOWED_ORIGINS) if CORS_ALLOWED_ORIGINS else FRONTEND_URL,
)
REALTIME_CHANNEL_ENCRYPTION_KEY = os.getenv(
    "REALTIME_CHANNEL_ENCRYPTION_KEY", SECRET_KEY
).strip() or SECRET_KEY

if REALTIME_ENABLED:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [REALTIME_REDIS_URL],
                "prefix": REALTIME_REDIS_PREFIX,
                "capacity": 150,
                "expiry": 60,
                "group_expiry": 86400,
                "symmetric_encryption_keys": [REALTIME_CHANNEL_ENCRYPTION_KEY],
            },
        }
    }
else:
    # L'API HTTP reste entièrement utilisable. Le layer mémoire évite les imports
    # conditionnels dans le code, mais l'endpoint ticket renvoie 503.
    CHANNEL_LAYERS = {
        "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
    }

# MFA TOTP (Google Authenticator et applications compatibles RFC 6238).
# En production, MFA_ENCRYPTION_KEY et MFA_RECOVERY_PEPPER doivent être des
# secrets longs, stables et distincts de JWT_SIGNING_KEY.
MFA_ISSUER = os.getenv("MFA_ISSUER", SITE_NAME)
MFA_ENCRYPTION_KEY = os.getenv("MFA_ENCRYPTION_KEY", "")
MFA_RECOVERY_PEPPER = os.getenv("MFA_RECOVERY_PEPPER", "")
MFA_LOGIN_CHALLENGE_MAX_AGE = int(os.getenv("MFA_LOGIN_CHALLENGE_MAX_AGE", "300"))
MFA_TOTP_VALID_WINDOW = int(os.getenv("MFA_TOTP_VALID_WINDOW", "1"))

PASSWORD_RESET_TIMEOUT = int(os.getenv("PASSWORD_RESET_TIMEOUT", "3600"))

EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend" if DEBUG else "django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or f"no-reply@localhost")

# F97 / fallback cPanel — les signalements peuvent dupliquer l'alerte temps réel
# par email. Par défaut, l'envoi est actif uniquement lorsqu'un compte SMTP est
# réellement configuré ; REPORT_EMAIL_FALLBACK_ENABLED peut forcer le choix.
REPORT_EMAIL_FALLBACK_ENABLED = env_bool(
    "REPORT_EMAIL_FALLBACK_ENABLED", bool(EMAIL_HOST_USER)
)
REPORT_EMAIL_FALLBACK_ALL_REPORTS = env_bool(
    "REPORT_EMAIL_FALLBACK_ALL_REPORTS", True
)


# Flux officiel WebCup / Terra Nova. La clé reste exclusivement côté backend.
WEBCUP_REQUESTS_URL = os.getenv(
    "WEBCUP_REQUESTS_URL",
    "https://24h.webcup.fr/wp-json/webcup/v1/requests",
).strip()
WEBCUP_API_KEY = os.getenv("WEBCUP_API_KEY", "").strip()
WEBCUP_REQUEST_TIMEOUT = float(os.getenv("WEBCUP_REQUEST_TIMEOUT", "8"))
WEBCUP_CACHE_SECONDS = int(os.getenv("WEBCUP_CACHE_SECONDS", "15"))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


SWAGGER_SETTINGS = {
    "SECURITY_DEFINITIONS": {
        "Bearer": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": 'JWT au format: Bearer <access_token>',
        }
    },
    "USE_SESSION_AUTH": False,
    "JSON_EDITOR": True,
    "PERSIST_AUTH": True,
}

REDOC_SETTINGS = {
    "LAZY_RENDERING": False,
}

# Les preuves des signalements ne doivent jamais être servies sous MEDIA_URL.
PRIVATE_REPORT_ROOT = Path(os.getenv("PRIVATE_REPORT_ROOT", str(BASE_DIR / "private_uploads")))
