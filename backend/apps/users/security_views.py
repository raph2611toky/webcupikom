from django.db import transaction
from django.utils import timezone
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from helpers.permissions import IsAuthenticatedAnyRole, IsAuthenticatedAgent, IsAuthenticatedAdmin
from .security_api import SecurityAPIView
from .auth_cookies import no_store, clear_refresh_cookie
from .models import AccountSession, User
from .services.sessions import revoke_session, revoke_all
from .services.security_otp import issue_otp, consume_otp
from .services.mfa import load_login_challenge, MFAError
from .serializers import SensitiveActionAuthSerializer


class OTPResponseSerializer(serializers.Serializer):
    email_challenge_id = serializers.UUIDField()
    expires_in = serializers.IntegerField()
    message = serializers.CharField()


class RevokedResponseSerializer(serializers.Serializer):
    revoked_count = serializers.IntegerField()
    requires_relogin = serializers.BooleanField()


class SecurityErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()
    errors = serializers.JSONField(required=False)


def responses(success, code=200):
    return {code: success, 400: SecurityErrorSerializer, 401: SecurityErrorSerializer,
            403: SecurityErrorSerializer, 429: SecurityErrorSerializer, 500: SecurityErrorSerializer}


class OTPLoginSendSerializer(serializers.Serializer):
    mfa_token = serializers.CharField(max_length=2048)


class OTPSendSensitiveSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=[
        '/api/account/change-password/', '/api/account/set-password/',
        '/api/account/change-email/', '/api/account/', '/api/account/mfa/disable/',
        '/api/account/mfa/recovery-codes/regenerate/',
    ])


class SessionSerializer(serializers.ModelSerializer):
    is_current = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = AccountSession
        fields = ['id', 'created_at', 'last_seen_at', 'expires_at', 'revoked_at',
                  'revoke_reason', 'user_agent', 'ip_address', 'is_current', 'status']

    def get_is_current(self, obj):
        return str(obj.pk) == str(self.context['request'].auth.get('sid'))

    def get_status(self, obj):
        if obj.revoked_at:
            return 'revoked'
        if obj.expires_at <= timezone.now() or obj.security_version != obj.user.auth_token_version:
            return 'expired'
        return 'active'


class RevokeRequestSerializer(SensitiveActionAuthSerializer):
    session_id = serializers.UUIDField(required=False)
    all_other_sessions = serializers.BooleanField(default=False)
    all_sessions = serializers.BooleanField(default=False)

    def validate(self, attrs):
        attrs = self.validate_authentication_fields(attrs)
        if sum((bool(attrs.get('session_id')), attrs['all_other_sessions'], attrs['all_sessions'])) != 1:
            raise serializers.ValidationError('Choisissez session_id, all_other_sessions ou all_sessions.')
        return attrs


class RevokeConfirmSerializer(serializers.Serializer):
    email_challenge_id = serializers.UUIDField()
    email_code = serializers.RegexField(r'^[0-9]{6}$')
    session_id = serializers.UUIDField(required=False)
    all_other_sessions = serializers.BooleanField(default=False)
    all_sessions = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if sum((bool(attrs.get('session_id')), attrs['all_other_sessions'], attrs['all_sessions'])) != 1:
            raise serializers.ValidationError('Choisissez session_id, all_other_sessions ou all_sessions.')
        return attrs


def otp_response(otp):
    return no_store(Response({'email_challenge_id': str(otp.pk), 'expires_in': 300,
                             'message': 'Un code de confirmation a été envoyé à votre adresse email.'}))


class MFALoginEmailSendView(SecurityAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'mfa'

    @swagger_auto_schema(security=[], request_body=OTPLoginSendSerializer, responses=responses(OTPResponseSerializer), tags=['Authentification'])
    def post(self, request):
        serializer = OTPLoginSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            challenge = load_login_challenge(serializer.validated_data['mfa_token'])
        except MFAError as exc:
            raise ValidationError(str(exc))
        user = User.objects.filter(pk=challenge.get('user_id'), mfa_enabled=True,
            is_active=True, email_verified=True, mfa_login_nonce=challenge.get('nonce')).first()
        if user is None or not user.mfa_login_nonce:
            raise ValidationError('Challenge MFA invalide.')
        return otp_response(issue_otp(user, 'login', user.mfa_login_nonce))


class MFASensitiveEmailSendView(SecurityAPIView):
    permission_classes = [IsAuthenticatedAnyRole]
    throttle_scope = 'mfa'

    @swagger_auto_schema(request_body=OTPSendSensitiveSerializer, responses=responses(OTPResponseSerializer), tags=['Sécurité du compte'])
    def post(self, request):
        serializer = OTPSendSensitiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not request.user.mfa_enabled:
            raise ValidationError('Le MFA doit être activé.')
        binding = str(request.auth['sid']) + ':' + serializer.validated_data['action']
        return otp_response(issue_otp(request.user, 'sensitive', binding))


class SessionListView(SecurityAPIView):
    permission_classes = [IsAuthenticatedAnyRole]

    @swagger_auto_schema(responses=responses(openapi.Schema(type='object', properties={'count': openapi.Schema(type='integer'), 'next': openapi.Schema(type='string', x_nullable=True), 'previous': openapi.Schema(type='string', x_nullable=True), 'results': openapi.Schema(type='array', items=openapi.Schema(type='object', properties={'id': openapi.Schema(type='string', format='uuid'), 'created_at': openapi.Schema(type='string', format='date-time'), 'last_seen_at': openapi.Schema(type='string', format='date-time'), 'expires_at': openapi.Schema(type='string', format='date-time'), 'revoked_at': openapi.Schema(type='string', format='date-time', x_nullable=True), 'revoke_reason': openapi.Schema(type='string'), 'ip_address': openapi.Schema(type='string', x_nullable=True), 'user_agent': openapi.Schema(type='string'), 'is_current': openapi.Schema(type='boolean'), 'status': openapi.Schema(type='string', enum=['active', 'expired', 'revoked'])}))})), tags=['Sessions'])
    def get(self, request):
        # Bounded history; no limit on the number of active sessions.
        sessions = AccountSession.objects.filter(user=request.user).select_related('user')
        from rest_framework.pagination import PageNumberPagination
        pagination = PageNumberPagination()
        pagination.page_size = 50
        page = pagination.paginate_queryset(sessions, request, view=self)
        return no_store(pagination.get_paginated_response(SessionSerializer(page, many=True, context={'request': request}).data))


def target_binding(request, data):
    current = str(request.auth['sid'])
    if data['all_sessions']:
        return current + ':all'
    if data['all_other_sessions']:
        return current + ':others'
    target = AccountSession.objects.filter(pk=data['session_id'], user=request.user).first()
    if target is None:
        raise ValidationError('Session introuvable.')
    return current + ':' + str(target.pk)


class SessionRevokeRequestView(SecurityAPIView):
    permission_classes = [IsAuthenticatedAnyRole]
    throttle_scope = 'mfa'

    @swagger_auto_schema(request_body=RevokeRequestSerializer, responses=responses(OTPResponseSerializer), tags=['Sessions'])
    def post(self, request):
        from .views import verify_sensitive_action_identity
        serializer = RevokeRequestSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        binding = target_binding(request, serializer.validated_data)
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            # Primary reauthentication + mandatory owner email OTP on confirmation.
            verify_sensitive_action_identity(user, serializer.validated_data, require_mfa=False)
        return otp_response(issue_otp(user, 'revoke', binding))


class SessionRevokeConfirmView(SecurityAPIView):
    permission_classes = [IsAuthenticatedAnyRole]
    throttle_scope = 'mfa'

    @swagger_auto_schema(request_body=RevokeConfirmSerializer, responses=responses(RevokedResponseSerializer), tags=['Sessions'])
    def post(self, request):
        serializer = RevokeConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        binding = target_binding(request, data)
        with transaction.atomic():
            user = User.objects.select_for_update().get(pk=request.user.pk)
            if user.auth_token_version != request.user.auth_token_version:
                raise ValidationError('La sécurité du compte a changé.')
            consume_otp(user, data['email_challenge_id'], data['email_code'], 'revoke', binding)
            sessions = AccountSession.objects.select_for_update().filter(user=user, revoked_at__isnull=True)
            if data['all_other_sessions']:
                sessions = sessions.exclude(pk=request.auth['sid'])
            elif not data['all_sessions']:
                sessions = sessions.filter(pk=data['session_id'])
            count = 0
            current_revoked = False
            for session in sessions:
                revoke_session(session, 'owner_revocation')
                current_revoked |= str(session.pk) == request.auth['sid']
                count += 1
            from .services.account_emails import send_security_alert
            transaction.on_commit(lambda: send_security_alert(user, f'{count} session(s) révoquée(s) depuis votre compte.'), robust=True)
        response = no_store(Response({'revoked_count': count, 'requires_relogin': current_revoked}))
        if current_revoked:
            clear_refresh_cookie(response)
        return response


class CurrentSessionLogoutView(SecurityAPIView):
    permission_classes = [IsAuthenticatedAnyRole]

    @swagger_auto_schema(responses=responses('Session déconnectée', code=204), tags=['Sessions'])
    def post(self, request):
        with transaction.atomic():
            User.objects.select_for_update().get(pk=request.user.pk)
            session = AccountSession.objects.select_for_update().get(pk=request.auth['sid'], user=request.user)
            revoke_session(session, 'logout')
        response = no_store(Response(status=204))
        clear_refresh_cookie(response)
        return response


class CSRFTokenView(SecurityAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @swagger_auto_schema(security=[], responses={200: openapi.Schema(type='object', properties={'csrf_token': openapi.Schema(type='string')})}, tags=['Authentification'])
    def get(self, request):
        return no_store(Response({'csrf_token': get_token(request)}))


class CitizenAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'phone_number', 'district', 'is_active']
        read_only_fields = ['id', 'email']


class CitizenAdminPageSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = CitizenAdminSerializer(many=True)


class CitizenAdminUpdateSerializer(SensitiveActionAuthSerializer):
    first_name = serializers.CharField(required=False, max_length=150)
    last_name = serializers.CharField(required=False, max_length=150)
    phone_number = serializers.CharField(required=False, max_length=32, allow_blank=True)
    district = serializers.CharField(required=False, max_length=120, allow_blank=True)
    is_active = serializers.BooleanField(required=False)

    def validate(self, attrs):
        forbidden = set(self.initial_data) - set(self.fields)
        if forbidden:
            raise serializers.ValidationError({key: 'Champ non autorisé.' for key in forbidden})
        return self.validate_authentication_fields(attrs)


class AgentCitizenListView(SecurityAPIView):
    permission_classes = [IsAuthenticatedAgent | IsAuthenticatedAdmin]

    @swagger_auto_schema(responses=responses(CitizenAdminPageSerializer), tags=['Comptes citoyens — agents'])
    def get(self, request):
        from rest_framework.pagination import PageNumberPagination
        queryset = User.objects.filter(role=User.Role.CITIZEN, is_superuser=False).order_by('id')
        search = request.query_params.get('search', '')[:150]
        if search:
            queryset = queryset.filter(email__icontains=search)
        pagination = PageNumberPagination()
        pagination.page_size = 50
        page = pagination.paginate_queryset(queryset, request, view=self)
        return no_store(pagination.get_paginated_response(CitizenAdminSerializer(page, many=True).data))


class AgentCitizenDetailView(SecurityAPIView):
    permission_classes = [IsAuthenticatedAgent | IsAuthenticatedAdmin]

    def citizen(self, pk, *, lock=False):
        from django.shortcuts import get_object_or_404
        queryset = User.objects.select_for_update() if lock else User.objects
        return get_object_or_404(queryset, pk=pk, role=User.Role.CITIZEN, is_superuser=False)

    @swagger_auto_schema(responses=responses(CitizenAdminSerializer), tags=['Comptes citoyens — agents'])
    def get(self, request, pk):
        return no_store(Response(CitizenAdminSerializer(self.citizen(pk)).data))

    @swagger_auto_schema(request_body=CitizenAdminUpdateSerializer, responses=responses(CitizenAdminSerializer), tags=['Comptes citoyens — agents'])
    def patch(self, request, pk):
        from .views import verify_sensitive_action_identity
        from .models import SecurityEvent
        serializer = CitizenAdminUpdateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            actor = User.objects.select_for_update().get(pk=request.user.pk)
            if not actor.is_active or actor.role not in (User.Role.AGENT, User.Role.ADMIN):
                raise ValidationError('Droits insuffisants.')
            verify_sensitive_action_identity(actor, serializer.validated_data)
            citizen = self.citizen(pk, lock=True)
            changes = {}
            for field in ('first_name', 'last_name', 'phone_number', 'district', 'is_active'):
                if field in serializer.validated_data:
                    value = serializer.validated_data[field]
                    if value != getattr(citizen, field):
                        changes[field] = value
                        setattr(citizen, field, value)
            citizen.save(update_fields=[*changes, 'updated_at'])
            # Invalidate before a subsequent reactivation can revive old sessions.
            if 'is_active' in changes:
                revoke_all(citizen, 'agent_status_change')
            SecurityEvent.objects.create(actor=actor, subject=citizen,
                kind='agent_citizen_update', details={'fields': list(changes)})
        return no_store(Response(CitizenAdminSerializer(citizen).data))


class SecurityEventSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import SecurityEvent
        model = SecurityEvent
        fields = ['id', 'kind', 'created_at', 'session_id', 'details']


class SecurityEventPageSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = SecurityEventSerializer(many=True)


class SecurityEventListView(SecurityAPIView):
    permission_classes = [IsAuthenticatedAnyRole]

    @swagger_auto_schema(responses=responses(SecurityEventPageSerializer), tags=['Sécurité du compte'])
    def get(self, request):
        from .models import SecurityEvent
        from rest_framework.pagination import PageNumberPagination
        pagination = PageNumberPagination()
        pagination.page_size = 50
        page = pagination.paginate_queryset(SecurityEvent.objects.filter(subject=request.user), request, view=self)
        return no_store(pagination.get_paginated_response(SecurityEventSerializer(page, many=True).data))
