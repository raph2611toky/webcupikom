from unittest.mock import patch

from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .services.account_emails import build_change_email_token
from .tokens import email_verification_token
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AccountApiTests(APITestCase):
    def create_verified_user(self, email="user@example.com", password="StrongPass!2026"):
        return User.objects.create_user(email=email, password=password, email_verified=True)

    def auth(self, user):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")

    def test_register_verify_and_login(self):
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
        self.assertIn("access", response.data["tokens"])

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

    def test_logout_blacklists_refresh_token(self):
        user = self.create_verified_user()
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        response = self.client.post(reverse("users:logout"), {"refresh": str(refresh)}, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
