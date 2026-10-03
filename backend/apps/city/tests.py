from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User

from .models import CitizenNotification, CitizenRequest, ContactMessage, MunicipalService


class TerraNovaRoleApiTests(APITestCase):
    def setUp(self):
        self.citizen = User.objects.create_user(
            email="citizen@example.com",
            password="StrongPass123!",
            role=User.Role.CITIZEN,
            email_verified=True,
            is_active=True,
        )
        self.agent = User.objects.create_user(
            email="agent@example.com",
            password="StrongPass123!",
            role=User.Role.AGENT,
            email_verified=True,
            is_active=True,
        )
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="StrongPass123!",
            role=User.Role.ADMIN,
            email_verified=True,
            is_active=True,
        )
        self.service = MunicipalService.objects.create(
            name="Administration",
            slug="administration-test",
            category="Administration",
            short_description="Service test",
            is_active=True,
        )

    def test_public_contact_creates_message(self):
        response = self.client.post(
            reverse("city:contact"),
            {
                "name": "Lina Nova",
                "email": "lina@example.com",
                "service": self.service.pk,
                "subject": "Question",
                "message": "Bonjour",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ContactMessage.objects.count(), 1)

    def test_agent_can_read_contact_but_citizen_cannot(self):
        ContactMessage.objects.create(
            name="Lina Nova",
            email="lina@example.com",
            service=self.service,
            subject="Question",
            message="Bonjour",
        )
        self.client.force_authenticate(self.citizen)
        denied = self.client.get(reverse("city:agent-contact-list"))
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.agent)
        allowed = self.client.get(reverse("city:agent-contact-list"))
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)

    def test_agent_request_update_creates_citizen_notification(self):
        item = CitizenRequest.objects.create(
            citizen=self.citizen,
            service=self.service,
            title="Lampadaire",
            description="Lampadaire cassé",
        )
        self.client.force_authenticate(self.agent)
        response = self.client.patch(
            reverse("city:agent-request-detail", kwargs={"reference": item.reference}),
            {"status": CitizenRequest.Status.IN_PROGRESS},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            CitizenNotification.objects.filter(
                user=self.citizen, related_request=item
            ).exists()
        )

    def test_admin_user_directory_is_admin_only(self):
        self.client.force_authenticate(self.agent)
        denied = self.client.get(reverse("city:admin-user-list"))
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        allowed = self.client.get(reverse("city:admin-user-list"))
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)


class SchemaGenerationSafetyTests(APITestCase):
    """Régression: drf-yasg parcourt get_queryset() avec un AnonymousUser."""

    def test_dynamic_querysets_are_safe_during_swagger_generation(self):
        from types import SimpleNamespace
        import inspect

        from django.contrib.auth.models import AnonymousUser
        from rest_framework.generics import GenericAPIView

        from . import views as city_views

        checked = []
        for _, view_class in inspect.getmembers(city_views, inspect.isclass):
            if view_class.__module__ != city_views.__name__:
                continue
            if not issubclass(view_class, GenericAPIView):
                continue
            if "get_queryset" not in view_class.__dict__:
                continue

            view = view_class()
            view.swagger_fake_view = True
            view.request = SimpleNamespace(user=AnonymousUser(), query_params={}, method="GET")

            try:
                queryset = view.get_queryset()
            except Exception as exc:  # pragma: no cover - message utile en cas de régression
                self.fail(f"{view_class.__name__}.get_queryset() plante pendant Swagger: {exc}")

            self.assertIsNotNone(queryset)
            checked.append(view_class.__name__)

        self.assertGreater(len(checked), 0)

    @override_settings(DEBUG=False)
    def test_unknown_url_returns_404_not_500(self):
        response = self.client.get("/__terra_nova_missing_route__/", HTTP_ACCEPT="text/html")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertContains(response, "Page introuvable", status_code=status.HTTP_404_NOT_FOUND)


class Wave2FeatureTests(APITestCase):
    def setUp(self):
        self.citizen = User.objects.create_user(
            email="wave2-citizen@example.com",
            password="StrongPass123!",
            role=User.Role.CITIZEN,
            email_verified=True,
            is_active=True,
        )
        self.agent = User.objects.create_user(
            email="wave2-agent@example.com",
            password="StrongPass123!",
            role=User.Role.AGENT,
            email_verified=True,
            is_active=True,
        )
        self.service = MunicipalService.objects.create(
            name="Éclairage public",
            slug="eclairage-public-test",
            category="Infrastructure",
            short_description="Éclairage des espaces publics",
            translations={
                "en": {
                    "name": "Street lighting",
                    "short_description": "Lighting for public spaces",
                }
            },
            is_featured=True,
            priority_order=1,
        )

    def test_request_creation_returns_confirmation_and_timeline(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.post(
            reverse("city:citizen-request-list"),
            {
                "service": self.service.pk,
                "title": "Question éclairage",
                "description": "Je souhaite une information.",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("confirmation", response.data)
        request_obj = CitizenRequest.objects.get(reference=response.data["reference"])
        self.assertTrue(request_obj.timeline_events.filter(is_public=True).exists())

    def test_issue_report_requires_location_and_is_saved_as_report(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.post(
            reverse("city:citizen-report-create"),
            {
                "service": self.service.pk,
                "incident_category": "lampadaire",
                "title": "Lampadaire cassé",
                "description": "Le lampadaire ne fonctionne plus.",
                "location_text": "Rue Nova, secteur Astra",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        item = CitizenRequest.objects.get(reference=response.data["reference"])
        self.assertEqual(item.request_type, CitizenRequest.RequestType.REPORT)
        self.assertEqual(item.location_text, "Rue Nova, secteur Astra")

    def test_preferences_persist_accessibility_and_language(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.patch(
            reverse("city:citizen-preferences"),
            {
                "language": "en",
                "screen_reader_mode": True,
                "high_contrast": True,
                "font_scale": 130,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.citizen.refresh_from_db()
        self.assertEqual(self.citizen.locale, "en")
        self.assertTrue(response.data["high_contrast"])
        self.assertEqual(response.data["font_scale"], 130)

    def test_onboarding_can_be_completed(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.patch(
            reverse("city:citizen-onboarding"),
            {"completed": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["completed"])
        self.assertEqual(response.data["step"], "done")

    def test_agent_summary_counts_requests_waiting_for_handling(self):
        CitizenRequest.objects.create(
            citizen=self.citizen,
            service=self.service,
            title="À prendre en charge",
            description="Test",
        )
        self.client.force_authenticate(self.agent)
        response = self.client.get(reverse("city:agent-request-summary"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["awaiting_handling"], 1)

    def test_service_can_be_returned_in_english(self):
        response = self.client.get(
            reverse("city:service-detail", kwargs={"slug": self.service.slug}),
            {"lang": "en"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Street lighting")
        self.assertEqual(response.data["language"], "en")
