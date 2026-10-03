"""Classes Swagger communes.

Elles ne contiennent aucune vue et n'importent aucune URL. Elles servent
uniquement à contrôler la représentation OpenAPI générée par drf-yasg.
"""

from drf_yasg.inspectors import SwaggerAutoSchema


class ManualFormAutoSchema(SwaggerAutoSchema):
    """Documente les entrées uniquement via des ``manual_parameters`` form-data.

    Les parsers DRF de la vue restent indépendants : l'API peut continuer à
    accepter JSON, form-urlencoded et multipart. Swagger, lui, affiche les
    champs individuellement et ne génère aucun body automatique.
    """

    def get_consumes(self):
        return ["multipart/form-data", "application/x-www-form-urlencoded"]

    def get_request_body_parameters(self, consumes):
        return []


class NoBodyAutoSchema(SwaggerAutoSchema):
    """Supprime tout body automatique pour les opérations sans payload."""

    def get_request_body_parameters(self, consumes):
        return []
