import re
from datetime import timedelta
from unittest.mock import patch

from django.conf import settings
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken

from .models import User, AccountSession, SecurityOTP, SecurityRateBucket, SecurityEvent
from .auth_cookies import build_refresh_token
from .services.mfa import encrypt_secret, issue_login_challenge


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class SecurityTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.user = User.objects.create_user(email='owner@example.com', password='StrongPass!2026', email_verified=True)
        self.other = User.objects.create_user(email='other@example.com', password='StrongPass!2026', email_verified=True)
        self.refresh = build_refresh_token(self.user, remember=False)
        self.auth(self.refresh)

    def auth(self, refresh):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer '+str(refresh.access_token))

    def code(self):
        match = re.search(r'letter-spacing:6px">([0-9]{6})', mail.outbox[-1].alternatives[0].content)
        self.assertIsNotNone(match)
        return match.group(1)

    def request_revoke(self, target=None, others=False):
        data = {'current_password': 'StrongPass!2026'}
        data.update({'all_other_sessions': True} if others else {'session_id': str(target['sid'])})
        response = self.client.post(reverse('users:session-revoke-request'), data, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return {'email_challenge_id': response.data['email_challenge_id'], 'email_code': self.code(),
                **({'all_other_sessions': True} if others else {'session_id': str(target['sid'])})}

    def test_revoke_immediately_rejects_access_and_refresh(self):
        target = build_refresh_token(self.user, remember=False)
        data = self.request_revoke(target)
        response = self.client.post(reverse('users:session-revoke-confirm'), data, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.auth(target)
        self.assertEqual(self.client.get(reverse('users:profile')).status_code, 401)
        self.client.cookies[settings.AUTH_REFRESH_COOKIE_NAME] = str(target)
        self.assertEqual(self.client.post(reverse('users:refresh'), {}, format='json').status_code, 401)
        self.auth(self.refresh)
        self.assertEqual(self.client.get(reverse('users:profile')).status_code, 200)

    def test_revoke_others_keeps_current_and_has_no_session_cap(self):
        targets = [build_refresh_token(self.user, remember=False) for _ in range(12)]
        data = self.request_revoke(others=True)
        response = self.client.post(reverse('users:session-revoke-confirm'), data, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['revoked_count'], 12)
        self.assertEqual(self.client.get(reverse('users:profile')).status_code, 200)
        self.auth(targets[-1])
        self.assertEqual(self.client.get(reverse('users:profile')).status_code, 401)

    def test_otp_cannot_be_replayed(self):
        target = build_refresh_token(self.user, remember=False)
        data = self.request_revoke(target)
        self.assertEqual(self.client.post(reverse('users:session-revoke-confirm'), data, format='json').status_code, 200)
        self.assertEqual(self.client.post(reverse('users:session-revoke-confirm'), data, format='json').status_code, 400)

    def test_otp_bound_to_target_and_calling_session(self):
        target = build_refresh_token(self.user, remember=False)
        extra = build_refresh_token(self.user, remember=False)
        data = self.request_revoke(target)
        changed = {**data, 'session_id': str(extra['sid'])}
        self.assertEqual(self.client.post(reverse('users:session-revoke-confirm'), changed, format='json').status_code, 400)
        self.auth(extra)
        self.assertEqual(self.client.post(reverse('users:session-revoke-confirm'), data, format='json').status_code, 400)
        self.auth(self.refresh)
        self.assertEqual(self.client.post(reverse('users:session-revoke-confirm'), data, format='json').status_code, 200)

    def test_other_users_session_is_inaccessible(self):
        other = build_refresh_token(self.other, remember=False)
        response = self.client.post(reverse('users:session-revoke-request'),
            {'current_password': 'StrongPass!2026', 'session_id': str(other['sid'])}, format='json')
        self.assertEqual(response.status_code, 400)
        listed = self.client.get(reverse('users:sessions'))
        self.assertEqual(listed.status_code, 200)
        self.assertNotIn(str(other['sid']), str(listed.data))
        self.assertTrue(listed.data['results'][0]['is_current'])
        self.assertNotIn('refresh_jti', listed.data['results'][0])

    def test_attempt_limit_persists_on_failed_transaction(self):
        data = self.request_revoke(build_refresh_token(self.user, remember=False))
        wrong = '111111' if data['email_code'] != '111111' else '222222'
        for _ in range(5):
            self.assertEqual(self.client.post(reverse('users:session-revoke-confirm'), {**data, 'email_code': wrong}, format='json').status_code, 400)
        self.assertEqual(SecurityOTP.objects.get(pk=data['email_challenge_id']).attempts, 5)
        self.assertEqual(self.client.post(reverse('users:session-revoke-confirm'), data, format='json').status_code, 400)

    def test_expired_otp_and_invalid_identifier_are_rejected(self):
        data = self.request_revoke(build_refresh_token(self.user, remember=False))
        SecurityOTP.objects.filter(pk=data['email_challenge_id']).update(expires_at=timezone.now()-timedelta(seconds=1))
        self.assertEqual(self.client.post(reverse('users:session-revoke-confirm'), data, format='json').status_code, 400)
        self.assertEqual(self.client.post(reverse('users:session-revoke-confirm'), {**data, 'email_challenge_id': 'invalid'}, format='json').status_code, 400)

    def test_current_logout_cuts_access(self):
        self.assertEqual(self.client.post(reverse('users:session-current-logout'), {}, format='json').status_code, 204)
        self.assertEqual(self.client.get(reverse('users:profile')).status_code, 401)

    def test_cookie_logout_cuts_access(self):
        self.client.cookies[settings.AUTH_REFRESH_COOKIE_NAME] = str(self.refresh)
        self.assertEqual(self.client.post(reverse('users:logout'), {}, format='json').status_code, 204)
        self.assertEqual(self.client.get(reverse('users:profile')).status_code, 401)

    def test_refresh_rotation_preserves_session_and_rejects_replay(self):
        self.client.cookies[settings.AUTH_REFRESH_COOKIE_NAME] = str(self.refresh)
        response = self.client.post(reverse('users:refresh'), {}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(AccessToken(response.data['access'])['sid'], self.refresh['sid'])
        session = AccountSession.objects.get(pk=self.refresh['sid'])
        self.assertNotEqual(session.refresh_jti, self.refresh['jti'])
        self.client.cookies[settings.AUTH_REFRESH_COOKIE_NAME] = str(self.refresh)
        self.assertEqual(self.client.post(reverse('users:refresh'), {}, format='json').status_code, 401)

    def test_email_mfa_login_never_sends_access_before_second_factor(self):
        self.user.mfa_enabled = True
        self.user.mfa_secret_encrypted = encrypt_secret('JBSWY3DPEHPK3PXP')
        self.user.save()
        self.client.credentials()
        login = self.client.post(reverse('users:login'), {'email': self.user.email, 'password': 'StrongPass!2026'}, format='json')
        self.assertEqual(login.status_code, 200, login.data)
        self.assertNotIn('access', login.data)
        self.assertIn('email', login.data['methods'])
        sent = self.client.post(reverse('users:mfa-email-send'), {'mfa_token': login.data['mfa_token']}, format='json')
        self.assertEqual(sent.status_code, 200, sent.data)
        self.assertEqual(mail.outbox[-1].to, [self.user.email])
        data = {'mfa_token': login.data['mfa_token'], 'email_challenge_id': sent.data['email_challenge_id'], 'email_code': self.code()}
        otp = SecurityOTP.objects.get(pk=sent.data['email_challenge_id'])
        self.assertNotEqual(otp.code_hash, data['email_code'])
        verified = self.client.post(reverse('users:mfa-verify-login'), data, format='json')
        self.assertEqual(verified.status_code, 200, verified.data)
        self.assertIn('sid', AccessToken(verified.data['access']))
        self.assertEqual(self.client.post(reverse('users:mfa-verify-login'), data, format='json').status_code, 400)

    def test_login_otp_bound_to_challenge(self):
        self.user.mfa_enabled = True
        self.user.save()
        first = issue_login_challenge(self.user, remember=False, auth_source='password')
        sent = self.client.post(reverse('users:mfa-email-send'), {'mfa_token': first}, format='json')
        self.assertEqual(sent.status_code, 200)
        code = self.code()
        second = issue_login_challenge(self.user, remember=False, auth_source='password')
        response = self.client.post(reverse('users:mfa-verify-login'), {'mfa_token': second,
            'email_challenge_id': sent.data['email_challenge_id'], 'email_code': code}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_wrong_password_does_not_send_revocation_otp(self):
        response = self.client.post(reverse('users:session-revoke-request'),
            {'session_id': self.refresh['sid'], 'current_password': 'wrong'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(SecurityOTP.objects.exists())

    def test_account_rate_limit_across_multiple_ips(self):
        self.client.credentials()
        for n in range(10):
            response = self.client.post(reverse('users:login'), {'email': self.user.email, 'password': 'wrong'},
                format='json', REMOTE_ADDR=f'192.0.2.{n+1}')
            self.assertEqual(response.status_code, 400, response.data)
        response = self.client.post(reverse('users:login'), {'email': self.user.email, 'password': 'StrongPass!2026'},
            format='json', REMOTE_ADDR='192.0.2.100')
        self.assertEqual(response.status_code, 429)
        SecurityRateBucket.objects.update(started_at=timezone.now()-timedelta(minutes=6))
        self.assertEqual(self.client.post(reverse('users:login'), {'email': self.user.email, 'password': 'StrongPass!2026'}, format='json').status_code, 200)

    def test_csrf_required_for_cookie_authentication(self):
        client = APIClient(enforce_csrf_checks=True)
        client.cookies[settings.AUTH_REFRESH_COOKIE_NAME] = str(self.refresh)
        self.assertEqual(client.post(reverse('users:refresh'), {}, format='json').status_code, 403)
        csrf = client.get(reverse('users:csrf'))
        self.assertEqual(csrf.status_code, 200)
        self.assertEqual(client.post(reverse('users:refresh'), {}, format='json', HTTP_X_CSRFTOKEN=csrf.data['csrf_token']).status_code, 200)

    def test_legacy_tokens_require_relogin(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer '+str(RefreshToken.for_user(self.user).access_token))
        self.assertEqual(self.client.get(reverse('users:profile')).status_code, 401)

    def test_password_change_revokes_all_sessions(self):
        response = self.client.post(reverse('users:change-password'), {'current_password': 'StrongPass!2026',
            'new_password': 'NewStrongPass!2026', 'new_password_confirm': 'NewStrongPass!2026'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.client.get(reverse('users:profile')).status_code, 401)
        self.assertFalse(AccountSession.objects.filter(user=self.user, revoked_at__isnull=True).exists())

    def test_mfa_email_for_sensitive_action_is_bound_to_endpoint(self):
        self.user.mfa_enabled = True
        self.user.mfa_secret_encrypted = encrypt_secret('JBSWY3DPEHPK3PXP')
        self.user.save()
        sent = self.client.post(reverse('users:mfa-sensitive-email-send'), {'action': '/api/account/change-password/'}, format='json')
        self.assertEqual(sent.status_code, 200, sent.data)
        data = {'current_password': 'StrongPass!2026', 'email_challenge_id': sent.data['email_challenge_id'],
                'email_code': self.code(), 'new_password': 'NewStrongPass!2026', 'new_password_confirm': 'NewStrongPass!2026'}
        invalid = self.client.post(reverse('users:mfa-disable'), data, format='json')
        self.assertEqual(invalid.status_code, 400)
        response = self.client.post(reverse('users:change-password'), data, format='json')
        self.assertEqual(response.status_code, 200, response.data)

    def test_agent_can_manage_only_citizens_and_changes_are_audited(self):
        agent = User.objects.create_user(email='agent@example.com', password='StrongPass!2026',
                                        role=User.Role.AGENT, email_verified=True)
        self.auth(build_refresh_token(agent, remember=False))
        self.assertEqual(self.client.get(reverse('users:agent-citizens')).status_code, 200)
        response = self.client.patch(reverse('users:agent-citizen', args=[self.user.pk]),
            {'is_active': False, 'current_password': 'StrongPass!2026'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(SecurityEvent.objects.filter(actor=agent, subject=self.user, kind='agent_citizen_update').exists())
        self.client.patch(reverse('users:agent-citizen', args=[self.user.pk]),
            {'is_active': True, 'current_password': 'StrongPass!2026'}, format='json')
        self.auth(self.refresh)
        self.assertEqual(self.client.get(reverse('users:profile')).status_code, 401)
        self.auth(build_refresh_token(agent, remember=False))
        self.assertEqual(self.client.patch(reverse('users:agent-citizen', args=[agent.pk]),
            {'is_active': False, 'current_password': 'StrongPass!2026'}, format='json').status_code, 404)
        self.assertEqual(self.client.patch(reverse('users:agent-citizen', args=[self.other.pk]),
            {'role': 'admin', 'current_password': 'StrongPass!2026'}, format='json').status_code, 400)

    def test_citizen_cannot_access_agent_administration(self):
        self.assertEqual(self.client.get(reverse('users:agent-citizens')).status_code, 403)

    def test_self_deletion_requires_identity_and_cascades_sessions(self):
        self.assertEqual(self.client.delete(reverse('users:delete-account'), {'confirmation': 'DELETE'}, format='json').status_code, 400)
        response = self.client.delete(reverse('users:delete-account'),
            {'confirmation': 'DELETE', 'current_password': 'StrongPass!2026'}, format='json')
        self.assertEqual(response.status_code, 204, response.data)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())
        self.assertFalse(AccountSession.objects.filter(pk=self.refresh['sid']).exists())
        self.assertEqual(self.client.get(reverse('users:profile')).status_code, 401)

    def test_all_sessions_revocation_includes_current(self):
        build_refresh_token(self.user, remember=False)
        sent = self.client.post(reverse('users:session-revoke-request'),
            {'all_sessions': True, 'current_password': 'StrongPass!2026'}, format='json')
        self.assertEqual(sent.status_code, 200, sent.data)
        response = self.client.post(reverse('users:session-revoke-confirm'),
            {'all_sessions': True, 'email_challenge_id': sent.data['email_challenge_id'], 'email_code': self.code()}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['requires_relogin'])
        self.assertEqual(response.data['revoked_count'], 2)
        self.assertEqual(self.client.get(reverse('users:profile')).status_code, 401)

    def test_refresh_rejects_security_version_change(self):
        self.user.auth_token_version += 1
        self.user.save()
        self.client.cookies[settings.AUTH_REFRESH_COOKIE_NAME] = str(self.refresh)
        self.assertEqual(self.client.post(reverse('users:refresh'), {}, format='json').status_code, 401)

    def test_invalid_signed_session_id_is_rejected_without_server_error(self):
        self.refresh['sid'] = 'malformed'
        self.auth(self.refresh)
        self.assertEqual(self.client.get(reverse('users:profile')).status_code, 401)

    def test_otp_send_limit_is_shared_between_sessions(self):
        data = {'current_password': 'StrongPass!2026', 'session_id': self.refresh['sid']}
        for _ in range(3):
            self.assertEqual(self.client.post(reverse('users:session-revoke-request'), data, format='json').status_code, 200)
        self.auth(build_refresh_token(self.user, remember=False))
        self.assertEqual(self.client.post(reverse('users:session-revoke-request'), data, format='json').status_code, 429)
        self.assertEqual(len(mail.outbox), 3)

    @patch('apps.users.services.security_otp.send_templated_email', side_effect=RuntimeError('SMTP unavailable'))
    def test_email_send_failure_invalidates_code(self, send):
        response = self.client.post(reverse('users:session-revoke-request'),
            {'current_password': 'StrongPass!2026', 'session_id': self.refresh['sid']}, format='json')
        self.assertEqual(response.status_code, 500)
        self.assertIsNotNone(SecurityOTP.objects.get().used_at)
        self.assertNotIn('SMTP', str(response.data))

    @override_settings(STORAGES={'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'}, 'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'}})
    def test_django_admin_session_is_invalidated_on_security_change(self):
        from django.test import Client
        from .services.sessions import revoke_all
        from django.db import transaction
        admin = User.objects.create_superuser(email='admin@example.com', password='StrongPass!2026')
        client = Client()
        client.force_login(admin)
        self.assertEqual(client.get('/admin/').status_code, 200)
        with transaction.atomic():
            locked = User.objects.select_for_update().get(pk=admin.pk)
            revoke_all(locked)
        self.assertEqual(client.get('/admin/').status_code, 302)
        self.assertNotIn('_auth_user_id', client.session)

    def test_change_email_confirmation_cannot_be_replayed(self):
        from .services.account_emails import build_change_email_token
        token = build_change_email_token(self.user, 'new@example.com')
        response = self.client.post(reverse('users:change-email-confirm'), {'token': token}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get(reverse('users:profile')).status_code, 401)
        self.assertEqual(self.client.post(reverse('users:change-email-confirm'), {'token': token}, format='json').status_code, 400)

    def test_csrf_is_required_at_login(self):
        client = APIClient(enforce_csrf_checks=True)
        data = {'email': self.user.email, 'password': 'StrongPass!2026'}
        self.assertEqual(client.post(reverse('users:login'), data, format='json').status_code, 403)
        csrf = client.get(reverse('users:csrf'))
        self.assertEqual(client.post(reverse('users:login'), data, format='json',
            HTTP_X_CSRFTOKEN=csrf.data['csrf_token']).status_code, 200)

    def test_revocation_for_google_only_account_requires_matching_google_owner(self):
        self.user.set_unusable_password()
        self.user.google_sub = 'owner-google-sub'
        self.user.save()
        self.refresh = build_refresh_token(self.user, remember=False)
        self.auth(self.refresh)
        with patch('apps.users.views.verify_google_credential', return_value={'sub': 'different-sub'}):
            response = self.client.post(reverse('users:session-revoke-request'),
                {'credential': 'google-token', 'session_id': self.refresh['sid']}, format='json')
            self.assertEqual(response.status_code, 400)
        with patch('apps.users.views.verify_google_credential', return_value={'sub': 'owner-google-sub'}):
            response = self.client.post(reverse('users:session-revoke-request'),
                {'credential': 'google-token', 'session_id': self.refresh['sid']}, format='json')
            self.assertEqual(response.status_code, 200, response.data)

    def test_invalid_json_shape_returns_validation_error(self):
        response = self.client.post(reverse('users:session-revoke-request'), ['invalid'], format='json')
        self.assertEqual(response.status_code, 400)

    def test_swagger_declares_email_proof_csrf_and_paginated_sessions(self):
        from config.swagger import schema_view
        from rest_framework.test import APIRequestFactory
        response = schema_view.without_ui(cache_timeout=0)(APIRequestFactory().get('/api/schema.json'), format='.json')
        self.assertEqual(response.status_code, 200)
        paths = response.data['paths']
        self.assertIn('/api/account/sessions/revoke/confirm/', paths)
        self.assertIn('/api/auth/mfa/email/send/', paths)
        headers = paths['/api/auth/login/']['post']['parameters']
        self.assertTrue(any(p['name'] == 'X-CSRFToken' and p['in'] == 'header' for p in headers))
        fields = paths['/api/auth/mfa/verify/']['post']['parameters']
        self.assertTrue(any(p['name'] == 'email_code' for p in fields))
        self.assertIn('results', paths['/api/account/sessions/']['get']['responses']['200']['schema']['properties'])
