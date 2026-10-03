from unittest.mock import patch
from types import SimpleNamespace
from .auth_cookies import build_refresh_token

from django.conf import settings
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .services.account_emails import build_change_email_token
from .services.mfa import encrypt_secret, generate_recovery_codes, totp_for_counter
from .tokens import email_verification_token
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AccountApiTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()

    def create_verified_user(self, email="user@example.com", password="StrongPass!2026"):
        return User.objects.create_user(email=email, password=password, email_verified=True)

    def auth(self, user):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {build_refresh_token(user, remember=False).access_token}")

    def test_register_verify_and_login(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(reverse("users:register"), {
                "email": "New@Example.com",
                "password": "StrongPass!2026",
                "password_confirm": "StrongPass!2026",
                "first_name": "Ada",
                "last_name": "Lovelace",
            }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="new@example.com")
        self.assertFalse(user.email_verified)
        self.assertEqual(len(mail.outbox), 1)

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = email_verification_token.make_token(user)
        response = self.client.post(reverse("users:verify-email"), {"uid": uid, "token": token}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.email_verified)

        response = self.client.post(reverse("users:login"), {"email": user.email, "password": "StrongPass!2026"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        self.assertIn(settings.AUTH_REFRESH_COOKIE_NAME, response.cookies)
        self.assertTrue(response.cookies[settings.AUTH_REFRESH_COOKIE_NAME]["httponly"])

    def test_register_accepts_single_password_and_returns_profile_step_token(self):
        response = self.client.post(reverse("users:register"), {
            "email": "flow@example.com",
            "password": "StrongPass!2026",
            "first_name": "Mia",
            "last_name": "Nova",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["next_step"], "complete_profile")
        self.assertIn("registration_token", response.data)

    def test_registration_profile_second_step(self):
        register = self.client.post(reverse("users:register"), {
            "email": "profile-flow@example.com",
            "password": "StrongPass!2026",
            "first_name": "Mia",
            "last_name": "Nova",
        }, format="json")
        token = register.data["registration_token"]

        response = self.client.post(reverse("users:register-profile"), {
            "registration_token": token,
            "first_name": "Mia",
            "last_name": "Nova",
            "profession": "Développeuse",
            "gender": "female",
            "birth_date": "2002-05-12",
            "phone_number": "+261340000000",
            "address": "12 rue Orion",
            "habitat": "Appartement",
            "district": "Astra",
            "sector": "Secteur 4",
            "building": "B",
            "apartment": "12",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["profile_completed"])
        self.assertEqual(response.data["next_step"], "verify_email")

        user = User.objects.get(email="profile-flow@example.com")
        self.assertEqual(user.profession, "Développeuse")
        self.assertEqual(user.gender, User.Gender.FEMALE)
        self.assertEqual(user.district, "Astra")
        self.assertIsNotNone(user.registration_profile_completed_at)

    def test_admin_can_register_agent_and_agent_uses_standard_verification_flow(self):
        admin = User.objects.create_superuser(
            email="admin@example.com",
            password="StrongPass!2026",
        )
        self.auth(admin)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(reverse("users:register-agent"), {
                "email": "agent@example.com",
                "password": "StrongPass!2026",
                "password_confirm": "StrongPass!2026",
                "first_name": "Alex",
                "last_name": "Agent",
            }, format="json")
    
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        agent = User.objects.get(email="agent@example.com")
        self.assertEqual(agent.role, User.Role.AGENT)
        self.assertFalse(agent.email_verified)
        self.assertFalse(agent.is_staff)
        self.assertEqual(len(mail.outbox), 1)

        self.client.credentials()
        uid = urlsafe_base64_encode(force_bytes(agent.pk))
        token = email_verification_token.make_token(agent)
        verify = self.client.post(
            reverse("users:verify-email"),
            {"uid": uid, "token": token},
            format="json",
        )
        self.assertEqual(verify.status_code, status.HTTP_200_OK)
        self.assertEqual(verify.data["user"]["role"], User.Role.AGENT)

    def test_public_user_cannot_self_register_as_agent(self):
        response = self.client.post(reverse("users:register-agent"), {
            "email": "rogue@example.com",
            "password": "StrongPass!2026",
            "password_confirm": "StrongPass!2026",
            "first_name": "Rogue",
            "last_name": "User",
        }, format="json")
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        self.assertFalse(User.objects.filter(email="rogue@example.com").exists())

    @override_settings(GOOGLE_CLIENT_ID="test-client.apps.googleusercontent.com")
    @patch("apps.users.views.verify_google_credential")
    def test_google_login_creates_user(self, verify_mock):
        verify_mock.return_value = {
            "sub": "google-123",
            "email": "google@example.com",
            "email_verified": True,
            "given_name": "Grace",
            "family_name": "Hopper",
            "picture": "https://example.com/avatar.png",
        }
        response = self.client.post(reverse("users:google-login"), {"credential": "fake-id-token"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user = User.objects.get(email="google@example.com")
        self.assertEqual(user.google_sub, "google-123")
        self.assertFalse(user.has_usable_password())


    def create_google_user(self, email="google-user@example.com", sub="google-sub-123"):
        user = User.objects.create_user(
            email=email,
            password=None,
            email_verified=True,
            google_sub=sub,
            auth_provider=User.AuthProvider.GOOGLE,
        )
        return user

    @patch("apps.users.views.verify_google_credential")
    def test_google_only_user_can_set_password_after_google_reauthentication(self, verify_mock):
        user = self.create_google_user()
        self.auth(user)
        verify_mock.return_value = {
            "sub": user.google_sub,
            "email": user.email,
            "email_verified": True,
        }

        response = self.client.post(
            reverse("users:change-password"),
            {
                "credential": "fresh-google-id-token",
                "new_password": "NewStrongPass!2026",
                "new_password_confirm": "NewStrongPass!2026",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.check_password("NewStrongPass!2026"))
        self.assertEqual(user.auth_provider, User.AuthProvider.HYBRID)

    @patch("apps.users.views.verify_google_credential")
    def test_google_only_set_password_endpoint_requires_and_accepts_google_reauthentication(self, verify_mock):
        user = self.create_google_user(email="set-password@example.com", sub="set-password-sub")
        self.auth(user)

        missing_reauth = self.client.post(
            reverse("users:set-password"),
            {
                "new_password": "FirstLocalPass!2026",
                "new_password_confirm": "FirstLocalPass!2026",
            },
            format="json",
        )
        self.assertEqual(missing_reauth.status_code, status.HTTP_400_BAD_REQUEST)

        verify_mock.return_value = {
            "sub": user.google_sub,
            "email": user.email,
            "email_verified": True,
        }
        response = self.client.post(
            reverse("users:set-password"),
            {
                "credential": "fresh-google-id-token",
                "new_password": "FirstLocalPass!2026",
                "new_password_confirm": "FirstLocalPass!2026",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.check_password("FirstLocalPass!2026"))
        self.assertEqual(user.auth_provider, User.AuthProvider.HYBRID)

    def test_local_user_can_still_change_password_with_current_password(self):
        user = self.create_verified_user(email="local-password@example.com")
        self.auth(user)

        response = self.client.post(
            reverse("users:change-password"),
            {
                "current_password": "StrongPass!2026",
                "new_password": "ChangedLocalPass!2026",
                "new_password_confirm": "ChangedLocalPass!2026",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.check_password("ChangedLocalPass!2026"))

    @patch("apps.users.views.verify_google_credential")
    def test_hybrid_user_can_change_password_with_google_instead_of_current_password(self, verify_mock):
        user = self.create_verified_user(email="hybrid@example.com")
        user.google_sub = "hybrid-google-sub"
        user.auth_provider = User.AuthProvider.HYBRID
        user.save(update_fields=["google_sub", "auth_provider", "updated_at"])
        self.auth(user)
        verify_mock.return_value = {
            "sub": user.google_sub,
            "email": user.email,
            "email_verified": True,
        }

        response = self.client.post(
            reverse("users:change-password"),
            {
                "credential": "fresh-google-id-token",
                "new_password": "AnotherStrongPass!2026",
                "new_password_confirm": "AnotherStrongPass!2026",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.check_password("AnotherStrongPass!2026"))

    @patch("apps.users.views.exchange_google_authorization_code")
    def test_google_reauthentication_also_accepts_oauth_code_and_state(self, exchange_mock):
        user = self.create_google_user(email="oauth-reauth@example.com", sub="oauth-reauth-sub")
        self.auth(user)
        exchange_mock.return_value = {
            "sub": user.google_sub,
            "email": user.email,
            "email_verified": True,
        }

        response = self.client.post(
            reverse("users:change-password"),
            {
                "code": "oauth-code",
                "state": "signed-google-state",
                "new_password": "OAuthStrongPass!2026",
                "new_password_confirm": "OAuthStrongPass!2026",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        exchange_mock.assert_called_once_with("oauth-code", "signed-google-state")

    @patch("apps.users.views.verify_google_credential")
    def test_google_only_user_can_delete_account_after_google_reauthentication(self, verify_mock):
        user = self.create_google_user(email="delete-google@example.com", sub="delete-google-sub")
        user_id = user.pk
        self.auth(user)
        verify_mock.return_value = {
            "sub": user.google_sub,
            "email": user.email,
            "email_verified": True,
        }

        response = self.client.delete(
            reverse("users:delete-account"),
            {"credential": "fresh-google-id-token", "confirmation": "DELETE"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=user_id).exists())

    @patch("apps.users.views.verify_google_credential")
    def test_google_reauthentication_must_match_linked_google_identity(self, verify_mock):
        user = self.create_google_user(email="protected@example.com", sub="expected-sub")
        self.auth(user)
        verify_mock.return_value = {
            "sub": "another-google-account",
            "email": "attacker@example.com",
            "email_verified": True,
        }

        response = self.client.delete(
            reverse("users:delete-account"),
            {"credential": "other-google-token", "confirmation": "DELETE"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(User.objects.filter(pk=user.pk).exists())
        self.assertIn("google", response.data["errors"])

    def test_google_only_user_cannot_delete_without_google_reauthentication(self):
        user = self.create_google_user(email="no-reauth@example.com", sub="no-reauth-sub")
        self.auth(user)

        response = self.client.delete(
            reverse("users:delete-account"),
            {"confirmation": "DELETE"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(User.objects.filter(pk=user.pk).exists())
        self.assertIn("google", response.data["errors"])

    def test_profile_update(self):
        user = self.create_verified_user()
        self.auth(user)
        response = self.client.patch(reverse("users:profile"), {"first_name": "Marie", "phone_number": "+261340000000"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.first_name, "Marie")

    def test_change_email_confirm(self):
        user = self.create_verified_user()
        token = build_change_email_token(user, "next@example.com")
        response = self.client.post(reverse("users:change-email-confirm"), {"token": token}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.email, "next@example.com")

    def test_refresh_uses_http_only_cookie(self):
        user = self.create_verified_user()
        login = self.client.post(
            reverse("users:login"),
            {"email": user.email, "password": "StrongPass!2026", "remember": True},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)

        response = self.client.post(reverse("users:refresh"), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        self.assertIn(settings.AUTH_REFRESH_COOKIE_NAME, response.cookies)

    def test_logout_blacklists_refresh_cookie_and_clears_it(self):
        user = self.create_verified_user()
        login = self.client.post(
            reverse("users:login"),
            {"email": user.email, "password": "StrongPass!2026"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)

        response = self.client.post(reverse("users:logout"), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIn(settings.AUTH_REFRESH_COOKIE_NAME, response.cookies)
        self.assertEqual(response.cookies[settings.AUTH_REFRESH_COOKIE_NAME].value, "")


    def test_mfa_setup_confirm_and_login_requires_second_factor(self):
        user = self.create_verified_user(email="mfa@example.com")
        self.auth(user)

        setup = self.client.post(
            reverse("users:mfa-setup"),
            {"current_password": "StrongPass!2026"},
            format="json",
        )
        self.assertEqual(setup.status_code, status.HTTP_200_OK)
        self.assertTrue(setup.data["qr_code_data_url"].startswith("data:image/png;base64,"))
        secret = setup.data["secret"]

        with patch("apps.users.services.mfa.time", SimpleNamespace(time=lambda: 1_800_000_000)):
            code = totp_for_counter(secret, int(1_800_000_000 // 30))
            confirm = self.client.post(
                reverse("users:mfa-confirm"), {"code": code}, format="json"
            )
        self.assertEqual(confirm.status_code, status.HTTP_200_OK)
        self.assertEqual(len(confirm.data["recovery_codes"]), 10)

        user.refresh_from_db()
        self.assertTrue(user.mfa_enabled)
        self.assertNotEqual(user.mfa_secret_encrypted, secret)

        self.client.credentials()
        login = self.client.post(
            reverse("users:login"),
            {"email": user.email, "password": "StrongPass!2026"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertTrue(login.data["mfa_required"])
        self.assertNotIn("access", login.data)

        with patch("apps.users.services.mfa.time", SimpleNamespace(time=lambda: 1_800_000_030)):
            next_code = totp_for_counter(secret, int(1_800_000_030 // 30))
            verify = self.client.post(
                reverse("users:mfa-verify-login"),
                {"mfa_token": login.data["mfa_token"], "mfa_code": next_code},
                format="json",
            )
        self.assertEqual(verify.status_code, status.HTTP_200_OK)
        self.assertIn("access", verify.data)
        self.assertTrue(verify.data["mfa_verified"])

    def test_mfa_recovery_code_is_single_use(self):
        user = self.create_verified_user(email="recovery@example.com")
        secret = "JBSWY3DPEHPK3PXP"
        recovery_codes, hashes = generate_recovery_codes()
        user.mfa_enabled = True
        user.mfa_secret_encrypted = encrypt_secret(secret)
        user.mfa_recovery_codes = hashes
        user.save(update_fields=["mfa_enabled", "mfa_secret_encrypted", "mfa_recovery_codes", "updated_at"])

        login = self.client.post(
            reverse("users:login"),
            {"email": user.email, "password": "StrongPass!2026"},
            format="json",
        )
        first = self.client.post(
            reverse("users:mfa-verify-login"),
            {"mfa_token": login.data["mfa_token"], "recovery_code": recovery_codes[0]},
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(len(user.mfa_recovery_codes), 9)

        self.client.cookies.clear()
        login2 = self.client.post(
            reverse("users:login"),
            {"email": user.email, "password": "StrongPass!2026"},
            format="json",
        )
        reused = self.client.post(
            reverse("users:mfa-verify-login"),
            {"mfa_token": login2.data["mfa_token"], "recovery_code": recovery_codes[0]},
            format="json",
        )
        self.assertEqual(reused.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sensitive_action_requires_mfa_when_enabled(self):
        user = self.create_verified_user(email="mfa-sensitive@example.com")
        secret = "JBSWY3DPEHPK3PXP"
        user.mfa_enabled = True
        user.mfa_secret_encrypted = encrypt_secret(secret)
        user.save(update_fields=["mfa_enabled", "mfa_secret_encrypted", "updated_at"])
        self.auth(user)

        missing = self.client.post(
            reverse("users:change-password"),
            {
                "current_password": "StrongPass!2026",
                "new_password": "ChangedMfaPass!2026",
                "new_password_confirm": "ChangedMfaPass!2026",
            },
            format="json",
        )
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("mfa", missing.data["errors"])

        with patch("apps.users.services.mfa.time", SimpleNamespace(time=lambda: 1_800_000_000)):
            code = totp_for_counter(secret, int(1_800_000_000 // 30))
            accepted = self.client.post(
                reverse("users:change-password"),
                {
                    "current_password": "StrongPass!2026",
                    "mfa_code": code,
                    "new_password": "ChangedMfaPass!2026",
                    "new_password_confirm": "ChangedMfaPass!2026",
                },
                format="json",
            )
        self.assertEqual(accepted.status_code, status.HTTP_200_OK)

    @patch("apps.users.views.verify_google_credential")
    def test_google_user_can_prepare_mfa_with_google_reauthentication(self, verify_mock):
        user = self.create_google_user(email="google-mfa@example.com", sub="google-mfa-sub")
        self.auth(user)
        verify_mock.return_value = {
            "sub": user.google_sub,
            "email": user.email,
            "email_verified": True,
        }
        response = self.client.post(
            reverse("users:mfa-setup"),
            {"credential": "fresh-google-id-token"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("otpauth_uri", response.data)

    def test_security_version_immediately_revokes_old_access_token(self):
        user = self.create_verified_user(email="revoked-token@example.com")
        old_access = str(build_refresh_token(user, remember=False).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {old_access}")
        before = self.client.get(reverse("users:profile"))
        self.assertEqual(before.status_code, status.HTTP_200_OK)

        user.auth_token_version += 1
        user.save(update_fields=["auth_token_version", "updated_at"])

        after = self.client.get(reverse("users:profile"))
        self.assertEqual(after.status_code, status.HTTP_401_UNAUTHORIZED)


class BackendStructureTests(APITestCase):
    def test_user_urls_reference_views_module_not_swagger_module(self):
        from . import urls as user_urls

        for pattern in user_urls.urlpatterns:
            callback = pattern.callback
            view_class = getattr(callback, "view_class", None)
            if view_class is not None:
                self.assertIn(view_class.__module__, {"apps.users.views", "apps.users.security_views"})

    def test_profile_supports_json_form_and_multipart_parsers(self):
        from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
        from .views import ProfileView

        self.assertIn(JSONParser, ProfileView.parser_classes)
        self.assertIn(FormParser, ProfileView.parser_classes)
        self.assertIn(MultiPartParser, ProfileView.parser_classes)
