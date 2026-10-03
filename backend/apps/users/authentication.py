from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class VersionedJWTAuthentication(JWTAuthentication):
    """Rejette immédiatement les JWT émis avant un changement de sécurité.

    Les anciens tokens sans claim ``security_version`` sont interprétés comme
    version 0, ce qui garde la compatibilité avant le premier changement MFA.
    """

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        try:
            token_version = int(validated_token.get("security_version", 0))
        except (TypeError, ValueError):
            raise AuthenticationFailed("Session invalide.", code="token_not_valid")

        if token_version != user.auth_token_version:
            raise AuthenticationFailed(
                "Cette session a été révoquée après une modification de sécurité du compte.",
                code="token_revoked",
            )
        return user
