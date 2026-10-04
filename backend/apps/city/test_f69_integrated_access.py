from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User

from .models import MunicipalService


class F69IntegratedAccessMatrixTests(APITestCase):
    """Permissions F69 rejouées après intégration F51/F52/F54/F76 et nouveaux modules."""

    def setUp(self):
        self.citizen = User.objects.create_user(
            email="f69-matrix-citizen@example.com", password="StrongPass!2026",
            role=User.Role.CITIZEN, email_verified=True, is_active=True,
        )
        self.agent = User.objects.create_user(
            email="f69-matrix-agent@example.com", password="StrongPass!2026",
            role=User.Role.AGENT, email_verified=True, is_active=True,
        )
        self.admin = User.objects.create_user(
            email="f69-matrix-admin@example.com", password="StrongPass!2026",
            role=User.Role.ADMIN, email_verified=True, is_active=True,
        )
        self.service = MunicipalService.objects.create(
            name="Service F69", slug="service-f69", short_description="Test F69", is_active=True,
        )

    def test_f52_anonymized_catalog_stays_public_but_support_action_is_protected(self):
        public = self.client.get(reverse("city:citizen-supportable-request-list"))
        self.assertEqual(public.status_code, status.HTTP_200_OK)

        support = self.client.post(
            reverse("city:citizen-request-support", kwargs={"reference": "UNKNOWN"}),
            {}, format="json",
        )
        self.assertIn(support.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_f76_agent_cannot_use_citizen_feedback_endpoint(self):
        self.client.force_authenticate(self.agent)
        response = self.client.get(
            reverse("city:citizen-service-feedback", kwargs={"slug": self.service.slug})
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_f51_agent_cannot_access_admin_privacy_endpoint(self):
        self.client.force_authenticate(self.agent)
        response = self.client.get(reverse("city:admin-privacy-concern-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_citizen_cannot_change_service_availability(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.patch(
            reverse("city:admin-service-availability", kwargs={"slug": self.service.slug}),
            {"is_available": False, "reason": "test"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_citizen_cannot_enter_project_or_location_administration(self):
        self.client.force_authenticate(self.citizen)
        self.assertEqual(
            self.client.get(reverse("city:admin-project-list")).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.get(reverse("city:admin-location-list")).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_admin_can_reach_integrated_admin_endpoints(self):
        self.client.force_authenticate(self.admin)
        for name in (
            "city:admin-project-list",
            "city:admin-location-list",
            "city:admin-service-feedback-list",
            "city:admin-privacy-concern-list",
        ):
            response = self.client.get(reverse(name))
            self.assertEqual(response.status_code, status.HTTP_200_OK, name)
