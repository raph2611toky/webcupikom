import hashlib
import re
from unittest.mock import patch

from django.conf import settings
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient

from apps.city.models import CitizenNotification

from .models import AccountDevice, AccountSession, SecurityEvent, User


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    AUTH_DEVICE_COOKIE_SECURE=False,
    AUTH_REFRESH_COOKIE_SECURE=False,
    REALTIME_ENABLED=False,
)
class NewDeviceAlertTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="f54-owner@example.com",
            password="StrongPass!2026",
            email_verified=True,
        )

    def login(self, client=None, *, ip="203.0.113.10", ua=None):
        client = client or self.client
        ua = ua or "Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0"
        with self.captureOnCommitCallbacks(execute=True):
            response = client.post(
                reverse("users:login"),
                {"email": self.user.email, "password": "StrongPass!2026"},
                format="json",
                REMOTE_ADDR=ip,
                HTTP_USER_AGENT=ua,
            )
        self.assertEqual(response.status_code, 200, response.data)
        return response

    def test_first_login_registers_device_and_alerts_owner(self):
        response = self.login()

        self.assertIn(settings.AUTH_DEVICE_COOKIE_NAME, response.cookies)
        self.assertEqual(AccountDevice.objects.filter(user=self.user).count(), 1)
        session = AccountSession.objects.get(user=self.user)
        self.assertTrue(session.is_new_device_login)
        self.assertIsNotNone(session.device_id)
        self.assertTrue(
            SecurityEvent.objects.filter(
                subject=self.user,
                kind="new_device_login",
                session_id=session.pk,
            ).exists()
        )
        notice = CitizenNotification.objects.get(
            user=self.user,
            notification_code=f"security:new-device:{session.pk}",
        )
        self.assertEqual(notice.kind, CitizenNotification.Kind.SYSTEM)
        self.assertIn("Nouvelle connexion", notice.title)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Alerte de sécurité", mail.outbox[0].subject)

    def test_same_device_does_not_generate_second_alert(self):
        self.login()
        first_cookie = self.client.cookies[settings.AUTH_DEVICE_COOKIE_NAME].value
        self.login(ip="198.51.100.44")

        self.assertEqual(self.client.cookies[settings.AUTH_DEVICE_COOKIE_NAME].value, first_cookie)
        self.assertEqual(AccountDevice.objects.filter(user=self.user).count(), 1)
        self.assertEqual(SecurityEvent.objects.filter(subject=self.user, kind="new_device_login").count(), 1)
        self.assertEqual(CitizenNotification.objects.filter(user=self.user, notification_code__startswith="security:new-device:").count(), 1)
        self.assertEqual(len(mail.outbox), 1)
        sessions = list(AccountSession.objects.filter(user=self.user).order_by("created_at"))
        self.assertEqual(len(sessions), 2)
        self.assertTrue(sessions[0].is_new_device_login)
        self.assertFalse(sessions[1].is_new_device_login)
        self.assertEqual(sessions[0].device_id, sessions[1].device_id)

    def test_different_browser_without_cookie_is_new_device(self):
        self.login()
        other_client = APIClient()
        self.login(
            other_client,
            ip="198.51.100.7",
            ua="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0",
        )

        self.assertEqual(AccountDevice.objects.filter(user=self.user).count(), 2)
        self.assertEqual(SecurityEvent.objects.filter(subject=self.user, kind="new_device_login").count(), 2)
        self.assertEqual(CitizenNotification.objects.filter(user=self.user, notification_code__startswith="security:new-device:").count(), 2)
        self.assertEqual(len(mail.outbox), 2)

    def test_device_cookie_is_opaque_and_only_user_scoped_hash_is_stored(self):
        response = self.login()
        raw = response.cookies[settings.AUTH_DEVICE_COOKIE_NAME].value
        device = AccountDevice.objects.get(user=self.user)
        expected = hashlib.sha256(f"{self.user.pk}:{raw}".encode("utf-8")).hexdigest()

        self.assertEqual(device.token_hash, expected)
        self.assertNotEqual(device.token_hash, raw)
        self.assertNotIn(raw, str(device.__dict__))

    def test_invalid_or_forged_cookie_cannot_suppress_new_device_detection(self):
        self.login()
        forged = APIClient()
        forged.cookies[settings.AUTH_DEVICE_COOKIE_NAME] = "forged"
        response = self.login(forged)

        self.assertNotEqual(response.cookies[settings.AUTH_DEVICE_COOKIE_NAME].value, "forged")
        self.assertEqual(AccountDevice.objects.filter(user=self.user).count(), 2)
        self.assertEqual(SecurityEvent.objects.filter(subject=self.user, kind="new_device_login").count(), 2)

    def test_session_api_exposes_device_without_secret(self):
        response = self.login()
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + response.data["access"])
        listed = self.client.get(reverse("users:sessions"))

        self.assertEqual(listed.status_code, 200, listed.data)
        item = listed.data["results"][0]
        self.assertTrue(item["is_current"])
        self.assertTrue(item["is_new_device_login"])
        self.assertIsNotNone(item["device"])
        self.assertIn("label", item["device"])
        self.assertNotIn("token_hash", str(listed.data))
        self.assertNotIn("refresh_jti", str(listed.data))

    @patch("apps.users.services.account_emails.send_security_alert", side_effect=RuntimeError("SMTP unavailable"))
    def test_email_failure_never_breaks_valid_login(self, _send):
        response = self.login()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(AccountDevice.objects.filter(user=self.user).count(), 1)
        self.assertTrue(SecurityEvent.objects.filter(subject=self.user, kind="new_device_login").exists())
        self.assertTrue(CitizenNotification.objects.filter(user=self.user, notification_code__startswith="security:new-device:").exists())

    def test_mfa_challenge_does_not_register_device_before_second_factor(self):
        self.user.mfa_enabled = True
        self.user.save(update_fields=["mfa_enabled", "updated_at"])

        login = self.client.post(
            reverse("users:login"),
            {"email": self.user.email, "password": "StrongPass!2026"},
            format="json",
            HTTP_USER_AGENT="Mozilla/5.0 Firefox/140.0",
            REMOTE_ADDR="203.0.113.12",
        )
        self.assertEqual(login.status_code, 200, login.data)
        self.assertTrue(login.data["mfa_required"])
        self.assertEqual(AccountDevice.objects.filter(user=self.user).count(), 0)
        self.assertEqual(AccountSession.objects.filter(user=self.user).count(), 0)

        sent = self.client.post(
            reverse("users:mfa-email-send"),
            {"mfa_token": login.data["mfa_token"]},
            format="json",
        )
        self.assertEqual(sent.status_code, 200, sent.data)
        html = mail.outbox[-1].alternatives[0].content
        match = re.search(r'letter-spacing:6px">([0-9]{6})', html)
        self.assertIsNotNone(match)

        with self.captureOnCommitCallbacks(execute=True):
            verified = self.client.post(
                reverse("users:mfa-verify-login"),
                {
                    "mfa_token": login.data["mfa_token"],
                    "email_challenge_id": sent.data["email_challenge_id"],
                    "email_code": match.group(1),
                },
                format="json",
                HTTP_USER_AGENT="Mozilla/5.0 Firefox/140.0",
                REMOTE_ADDR="203.0.113.12",
            )
        self.assertEqual(verified.status_code, 200, verified.data)
        self.assertEqual(AccountDevice.objects.filter(user=self.user).count(), 1)
        self.assertEqual(AccountSession.objects.filter(user=self.user).count(), 1)
        self.assertTrue(SecurityEvent.objects.filter(subject=self.user, kind="new_device_login").exists())

    def test_same_cookie_is_not_correlatable_between_accounts_in_database(self):
        response = self.login()
        raw = response.cookies[settings.AUTH_DEVICE_COOKIE_NAME].value
        other = User.objects.create_user(
            email="f54-other@example.com",
            password="StrongPass!2026",
            email_verified=True,
        )
        client = APIClient()
        client.cookies[settings.AUTH_DEVICE_COOKIE_NAME] = raw
        with self.captureOnCommitCallbacks(execute=True):
            other_login = client.post(
                reverse("users:login"),
                {"email": other.email, "password": "StrongPass!2026"},
                format="json",
                HTTP_USER_AGENT="Mozilla/5.0 Firefox/140.0",
                REMOTE_ADDR="203.0.113.10",
            )
        self.assertEqual(other_login.status_code, 200, other_login.data)

        first_hash = AccountDevice.objects.get(user=self.user).token_hash
        second_hash = AccountDevice.objects.get(user=other).token_hash
        self.assertNotEqual(first_hash, second_hash)
