"""Permissions DRF centralisées par rôle Terra Nova.

Les permissions de rôle restent indépendantes des vues afin d'éviter de
répliquer la logique d'autorisation dans chaque application.
"""

from rest_framework.permissions import BasePermission


class _BaseAuthenticatedRolePermission(BasePermission):
    allowed_roles = frozenset()
    message = "Vous n'avez pas les permissions nécessaires pour accéder à cette ressource."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or not getattr(user, "is_active", False):
            return False
        return getattr(user, "role", None) in self.allowed_roles


class IsAuthenticatedCitizen(_BaseAuthenticatedRolePermission):
    """Autorise uniquement un utilisateur authentifié avec le rôle citizen."""

    allowed_roles = frozenset({"citizen"})
    message = "Cet espace est réservé aux citoyens authentifiés."


class IsAuthenticatedAgent(_BaseAuthenticatedRolePermission):
    """Autorise uniquement un utilisateur authentifié avec le rôle agent."""

    allowed_roles = frozenset({"agent"})
    message = "Cet espace est réservé aux agents municipaux authentifiés."


class IsAuthenticatedAdmin(_BaseAuthenticatedRolePermission):
    """Autorise uniquement un administrateur authentifié.

    ``is_superuser`` reste accepté par sécurité même si le modèle force déjà
    normalement son rôle à ``admin``.
    """

    allowed_roles = frozenset({"admin"})
    message = "Cet espace est réservé aux administrateurs authentifiés."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or not getattr(user, "is_active", False):
            return False
        return bool(getattr(user, "is_superuser", False) or getattr(user, "role", None) == "admin")


class IsAuthenticatedAnyRole(_BaseAuthenticatedRolePermission):
    """Permission de secours pour les endpoints communs aux trois profils."""

    allowed_roles = frozenset({"citizen", "agent", "admin"})
    message = "Authentification requise."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or not getattr(user, "is_active", False):
            return False
        return bool(
            getattr(user, "is_superuser", False)
            or getattr(user, "role", None) in self.allowed_roles
        )
