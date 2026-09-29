from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    """Normalise les erreurs DRF afin que les réponses réelles correspondent au Swagger."""
    response = exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, ValidationError):
        response.data = {
            "detail": "Données invalides.",
            "errors": response.data,
        }
        return response

    if not isinstance(response.data, dict):
        response.data = {"detail": str(response.data)}
    elif "detail" not in response.data:
        response.data = {
            "detail": "La requête n'a pas pu être traitée.",
            "errors": response.data,
        }
    return response
