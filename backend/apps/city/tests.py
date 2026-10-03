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
