from django.conf import settings
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from types import SimpleNamespace
from rest_framework import status
from rest_framework.test import APITestCase

from helpers.throttles import SensitiveMutationRateThrottle

from .models import SecurityEvent, User


@override_settings(
    REALTIME_ENABLED=False,
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    AUTH_DEVICE_COOKIE_SECURE=False,
    AUTH_REFRESH_COOKIE_SECURE=False,
)
class F69SecurityTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.citizen = User.objects.create_user(
            email="f69-citizen@example.com",
            password="StrongPass!2026",
            role=User.Role.CITIZEN,
            email_verified=True,
            is_active=True,
        )
        self.agent = User.objects.create_user(
            email="f69-agent@example.com",
            password="StrongPass!2026",
            role=User.Role.AGENT,
            email_verified=True,
            is_active=True,
        )
        self.admin = User.objects.create_user(
            email="f69-admin@example.com",
            password="StrongPass!2026",
            role=User.Role.ADMIN,
            email_verified=True,
            is_active=True,
        )

    def test_public_api_has_defensive_security_headers(self):
        response = self.client.get(reverse("city:service-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response["X-Frame-Options"], "DENY")
        self.assertEqual(response["Referrer-Policy"], "no-referrer")
        self.assertIn("camera=()", response["Permissions-Policy"])
        self.assertIn("default-src 'none'", response["Content-Security-Policy"])

    def test_sensitive_api_is_not_cacheable(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.get(reverse("users:sessions"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("no-store", response["Cache-Control"])
        self.assertEqual(response["Pragma"], "no-cache")
        self.assertEqual(response["Expires"], "0")

    def test_anonymous_cannot_read_account_sessions(self):
        response = self.client.get(reverse("users:sessions"))
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_citizen_cannot_access_admin_system(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.get(reverse("city:admin-system"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_agent_cannot_manage_admin_users(self):
        self.client.force_authenticate(self.agent)
        response = self.client.get(reverse("city:admin-user-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_access_admin_system(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse("city:admin-system"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_change_password_creates_explicit_security_audit(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.post(
            reverse("users:change-password"),
            {
                "current_password": "StrongPass!2026",
                "new_password": "NewStrongPass!2026",
                "new_password_confirm": "NewStrongPass!2026",
            },
            format="json",
            REMOTE_ADDR="203.0.113.69",
            HTTP_USER_AGENT="F69-Test-Agent",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, getattr(response, "data", None))
        event = SecurityEvent.objects.filter(subject=self.citizen, kind="password_changed").latest("created_at")
        self.assertEqual(event.details["ip_address"], "203.0.113.69")
        self.assertEqual(event.details["method"], "POST")
        serialized = str(event.details).lower()
        self.assertNotIn("newstrongpass", serialized)
        self.assertNotIn("current_password", serialized)

    def test_sensitive_write_throttle_rejects_burst_for_same_view(self):
        throttle = SensitiveMutationRateThrottle()
        throttle.rate = "2/min"
        throttle.num_requests, throttle.duration = throttle.parse_rate(throttle.rate)
        request = SimpleNamespace(
            method="POST",
            path="/api/account/change-password/",
            user=self.citizen,
            META={"REMOTE_ADDR": "203.0.113.69"},
        )
        # Une vraie instance suffit pour produire une clé stable par vue.
        class SensitiveView:
            pass
        view = SensitiveView()

        self.assertTrue(throttle.allow_request(request, view))
        self.assertTrue(throttle.allow_request(request, view))
        self.assertFalse(throttle.allow_request(request, view))

        self.assertTrue(settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["f69_sensitive_read"])

    def test_cors_private_network_is_disabled_by_default(self):
        self.assertFalse(settings.CORS_ALLOW_PRIVATE_NETWORK)
