from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User

from .models import ContactMessage, MunicipalService, StaffAuditEvent


class MunicipalServiceAvailabilityTests(APITestCase):
    def setUp(self):
        self.citizen = User.objects.create_user(
            email="availability-citizen@example.com",
            password="StrongPass123!",
            role=User.Role.CITIZEN,
            email_verified=True,
            is_active=True,
        )
        self.agent = User.objects.create_user(
            email="availability-agent@example.com",
            password="StrongPass123!",
            role=User.Role.AGENT,
            email_verified=True,
            is_active=True,
        )
        self.admin = User.objects.create_user(
            email="availability-admin@example.com",
            password="StrongPass123!",
            role=User.Role.ADMIN,
            email_verified=True,
            is_active=True,
        )
        self.service = MunicipalService.objects.create(
            name="État civil",
            slug="etat-civil-availability",
            category="Administration",
            short_description="Documents d'état civil",
            is_active=True,
        )

    def test_agent_responsible_can_mark_service_unavailable_with_citizen_guidance(self):
        self.client.force_authenticate(self.agent)
        restore_at = timezone.now() + timedelta(hours=4)
        response = self.client.patch(
            reverse("city:agent-service-availability", kwargs={"slug": self.service.slug}),
            {
                "is_available": False,
                "reason": "Maintenance technique en cours.",
                "alternative_action": "Utilisez le formulaire de contact pour les demandes urgentes.",
                "expected_restore_at": restore_at.isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.service.refresh_from_db()
        self.assertFalse(self.service.is_active)
        self.assertIsNotNone(self.service.unavailable_since)
        self.assertEqual(self.service.unavailability_reason, "Maintenance technique en cours.")
        self.assertTrue(
            StaffAuditEvent.objects.filter(
                action="service.unavailable",
                actor=self.agent,
                resource_reference=self.service.slug,
            ).exists()
        )

    def test_unavailable_service_remains_visible_to_citizen(self):
        self.service.set_availability(
            is_available=False,
            reason="Incident technique.",
            alternative_action="Réessayez demain matin.",
            expected_restore_at=timezone.now() + timedelta(days=1),
        )
        detail = self.client.get(reverse("city:service-detail", kwargs={"slug": self.service.slug}))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["availability"]["status"], "unavailable")
        self.assertFalse(detail.data["availability"]["is_available"])
        self.assertFalse(detail.data["availability"]["can_start_request"])
        self.assertEqual(detail.data["availability"]["reason"], "Incident technique.")
        self.assertEqual(detail.data["availability"]["next_action"], "Réessayez demain matin.")

        listing = self.client.get(reverse("city:service-list"), {"available": "false"})
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        slugs = {item["slug"] for item in listing.data}
        self.assertIn(self.service.slug, slugs)

    def test_existing_citizen_actions_still_reject_unavailable_service(self):
        self.service.set_availability(
            is_available=False,
            reason="Maintenance.",
            alternative_action="Contactez l'accueil.",
        )
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
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ContactMessage.objects.count(), 0)

    def test_citizen_cannot_change_availability(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.patch(
            reverse("city:agent-service-availability", kwargs={"slug": self.service.slug}),
            {"is_available": False, "reason": "Tentative"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_restore_service_and_clear_outage_metadata(self):
        self.service.set_availability(
            is_available=False,
            reason="Incident technique.",
            alternative_action="Réessayez plus tard.",
            expected_restore_at=timezone.now() + timedelta(hours=2),
        )
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            reverse("city:admin-service-availability", kwargs={"slug": self.service.slug}),
            {"is_available": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.service.refresh_from_db()
        self.assertTrue(self.service.is_active)
        self.assertEqual(self.service.unavailability_reason, "")
        self.assertEqual(self.service.alternative_action, "")
        self.assertIsNone(self.service.unavailable_since)
        self.assertIsNone(self.service.expected_restore_at)
        self.assertTrue(
            StaffAuditEvent.objects.filter(
                action="service.restore",
                actor=self.admin,
                resource_reference=self.service.slug,
            ).exists()
        )

    def test_reason_is_required_when_marking_unavailable(self):
        self.client.force_authenticate(self.agent)
        response = self.client.patch(
            reverse("city:agent-service-availability", kwargs={"slug": self.service.slug}),
            {"is_available": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.service.refresh_from_db()
        self.assertTrue(self.service.is_active)
