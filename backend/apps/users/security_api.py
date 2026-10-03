from rest_framework.views import APIView as BaseAPIView
from .services.security_otp import reserve_attempt, rate_limit
from .services.sessions import request_ip


class SecurityAPIView(BaseAPIView):
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            rate_limit('security-ip:'+str(request_ip(request)), 120, 300)
            from collections.abc import Mapping
            from rest_framework.exceptions import ValidationError
            if not isinstance(request.data, Mapping):
                raise ValidationError('Un objet JSON est requis.')
            if request.data.get('email_challenge_id'):
                # Outside action transactions: failed checks cannot roll back the attempt counter.
                from rest_framework.exceptions import ValidationError
                from .services.mfa import load_login_challenge, MFAError
                user_id = request.user.pk if request.user.is_authenticated else None
                if request.data.get('mfa_token'):
                    try:
                        user_id = load_login_challenge(request.data['mfa_token']).get('user_id')
                    except MFAError as exc:
                        raise ValidationError(str(exc))
                if user_id is None:
                    raise ValidationError('Challenge invalide.')
                reserve_attempt(request.data['email_challenge_id'], user_id)
            if request.data.get('mfa_token'):
                rate_limit('mfa-proof:'+str(request.data['mfa_token']), 10, 300)
            if request.path.endswith('/auth/login/'):
                email = str(request.data.get('email', '')).strip().lower()
                rate_limit('login-ip:'+str(request_ip(request)), 60, 300)
                rate_limit('login-account:'+email, 10, 300)
            elif getattr(request.user, 'is_authenticated', False):
                rate_limit('security-action:'+str(request.user.pk), 20, 300)

    def finalize_response(self, request, response, *args, **kwargs):
        from .auth_cookies import no_store
        return no_store(super().finalize_response(request, response, *args, **kwargs))

    def handle_exception(self, exc):
        from rest_framework.exceptions import APIException
        from django.http import Http404
        from django.core.exceptions import PermissionDenied
        if isinstance(exc, (APIException, Http404, PermissionDenied)):
            return super().handle_exception(exc)
        from .views import server_error
        return server_error(exc, self.__class__.__name__)
