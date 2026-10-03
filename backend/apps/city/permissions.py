"""Compatibilité des anciennes permissions de l'application city.

Les nouvelles permissions centralisées vivent dans ``helpers.permissions``.
"""

from helpers.permissions import (
    IsAuthenticatedAdmin,
    IsAuthenticatedAgent,
    IsAuthenticatedCitizen,
)

# Alias conservés temporairement pour ne casser aucun import existant.
IsCitizen = IsAuthenticatedCitizen
IsAgentOrAdmin = IsAuthenticatedAgent | IsAuthenticatedAdmin

__all__ = [
    "IsAuthenticatedCitizen",
    "IsAuthenticatedAgent",
    "IsAuthenticatedAdmin",
    "IsCitizen",
    "IsAgentOrAdmin",
]
