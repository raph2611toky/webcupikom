from django.contrib.auth import logout
from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver


@receiver(user_logged_in)
def bind_django_session_security(sender, request, user, **kwargs):
    if request is not None:
        request.session['account_security_version'] = user.auth_token_version


class DjangoSessionSecurityMiddleware:
    """Reject legacy/revoked Django sessions as well as disabled admin accounts."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            version = request.session.get('account_security_version')
            if version != request.user.auth_token_version or not request.user.is_active:
                logout(request)
        return self.get_response(request)
