from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import User
from apps.users.services.sessions import create_session
from apps.realtime.tickets import RealtimeUnavailable


class RealtimeTicketHTTPTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="socket-citizen@example.com",
            password="SocketPass123!",
            role=User.Role.CITIZEN,
            is_active=True,
            email_verified=True,
        )
        self.refresh = RefreshToken.for_user(self.user)
        self.refresh["security_version"] = self.user.auth_token_version
        self.session = create_session(self.user, self.refresh)
        access = self.refresh.access_token
        access["security_version"] = self.user.auth_token_version
        access["sid"] = str(self.session.pk)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    @patch("apps.realtime.views.issue_ticket", return_value=("one-time-ticket", 30))
    def test_ticket_uses_existing_http_auth(self, issue):
        response = self.client.post(reverse("realtime:ticket"), {}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["ticket"], "one-time-ticket")
        self.assertTrue(response.data["http_fallback"])
        issue.assert_called_once()

    def test_ticket_requires_authentication(self):
        response = APIClient().post(reverse("realtime:ticket"), {}, format="json")
        self.assertIn(response.status_code, {401, 403})


    @patch("apps.realtime.views.issue_ticket", side_effect=RealtimeUnavailable("down"))
    def test_ticket_redis_failure_keeps_http_fallback(self, issue):
        response = self.client.post(reverse("realtime:ticket"), {}, format="json")
        self.assertEqual(response.status_code, 503)
        self.assertTrue(response.data["http_fallback"])
        self.assertFalse(response.data["realtime_available"])

    @patch("apps.realtime.views.sync_redis_client")
    def test_status_reports_redis_failure_without_500(self, redis_client):
        redis_client.return_value.ping.side_effect = OSError("redis down")
        response = self.client.get(reverse("realtime:status"))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["available"])
        self.assertTrue(response.data["http_fallback"])

    @patch("apps.realtime.views.issue_ticket", side_effect=Exception("unexpected"))
    def test_unexpected_errors_are_not_silently_hidden(self, issue):
        # Les erreurs applicatives ordinaires gardent le traitement DRF normal.
        with self.assertRaises(Exception):
            self.client.post(reverse("realtime:ticket"), {}, format="json")
