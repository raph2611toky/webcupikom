import functools
import logging
import os
import secrets

from django.shortcuts import redirect, render
from django.views.decorators.cache import never_cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    try:
        return Response({
            "status": "ok",
            "service": "webcup-backend",
        }, status=status.HTTP_200_OK)
    except Exception as exc:
        logger.exception("Erreur non gérée dans health", exc_info=exc)
        return Response(
            {"detail": "Une erreur interne est survenue."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


def swagger_password_protect(view_func):
    """Protège Swagger, ReDoc et le schéma OpenAPI avec un mot de passe de session."""

    @never_cache
    @functools.wraps(view_func)
    def wrapper(request, *args, **kwargs):
        swagger_password = os.getenv("SWAGGER_PASSWORD", "").strip()

        if not swagger_password:
            return render(
                request,
                "swagger_login.html",
                {
                    "error": (
                        "La protection Swagger n'est pas configurée. "
                        "Définissez SWAGGER_PASSWORD dans le fichier .env."
                    ),
                    "configuration_error": True,
                },
                status=503,
            )

        if request.session.get("swagger_authenticated", False):
            return view_func(request, *args, **kwargs)

        if request.method == "POST":
            entered_password = request.POST.get("password", "")

            if secrets.compare_digest(entered_password, swagger_password):
                # Renouvelle l'identifiant de session au moment du passage
                # d'un état non authentifié à authentifié.
                request.session.cycle_key()
                request.session["swagger_authenticated"] = True
                request.session.set_expiry(3600)
                request.session.modified = True
                return redirect(request.path)

            return render(
                request,
                "swagger_login.html",
                {"error": "Mot de passe incorrect. Vérifiez votre saisie et réessayez."},
                status=403,
            )

        return render(request, "swagger_login.html")

    return wrapper


@never_cache
def custom_404(request, exception):
    return render(request, "404.html", status=404)
