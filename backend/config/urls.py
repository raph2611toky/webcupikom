from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from config.swagger import health, schema_view
from config.views import swagger_password_protect


# La même protection couvre l'interface Swagger, ReDoc et le schéma brut.
protected_swagger = swagger_password_protect(
    schema_view.with_ui("swagger", cache_timeout=0)
)
protected_redoc = swagger_password_protect(
    schema_view.with_ui("redoc", cache_timeout=0)
)
protected_schema = swagger_password_protect(
    schema_view.without_ui(cache_timeout=0)
)


urlpatterns = [
    path("health/", health, name="health"),
    path("api/", include("apps.users.urls")),
    path("api/", include("apps.city.urls")),
    path("admin/", admin.site.urls),

    # Documentation API protégée
    re_path(
        r"^api/schema(?P<format>\.json|\.yaml)$",
        protected_schema,
        name="schema-json",
    ),
    path("api/docs/", protected_swagger, name="schema-swagger-ui"),
    path("api/redoc/", protected_redoc, name="schema-redoc"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

handler404 = "config.views.custom_404"
