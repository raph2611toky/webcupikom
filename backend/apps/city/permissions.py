from rest_framework.permissions import BasePermission


class IsCitizen(BasePermission):
    message = "Cet espace est réservé aux citoyens."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "role", None) == "citizen"
        )


class IsAgentOrAdmin(BasePermission):
    message = "Cet espace est réservé aux agents municipaux et administrateurs."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return getattr(user, "role", None) in {"agent", "admin"}
