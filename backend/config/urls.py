from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from drf_yasg import openapi
from drf_yasg.views import get_schema_view
from rest_framework.permissions import AllowAny

from config.views import health

schema_view = get_schema_view(
    openapi.Info(
        title="WebCup Ikom API",
        default_version="v1",
        description=(
            "API backend : authentification locale/Google, gestion de compte et profil. "
            "Les endpoints protégés utilisent un JWT Bearer."
        ),
        contact=openapi.Contact(email=settings.SUPPORT_EMAIL),
    ),
    public=True,
    permission_classes=[AllowAny],
)

urlpatterns = [
    path("health/", health, name="health"),
    path("api/", include("apps.users.urls")),
    path("admin/", admin.site.urls),

    # Documentation API
    re_path(r"^api/schema(?P<format>\.json|\.yaml)$", schema_view.without_ui(cache_timeout=0), name="schema-json"),
    path("api/docs/", schema_view.with_ui("swagger", cache_timeout=0), name="schema-swagger-ui"),
    path("api/redoc/", schema_view.with_ui("redoc", cache_timeout=0), name="schema-redoc"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
