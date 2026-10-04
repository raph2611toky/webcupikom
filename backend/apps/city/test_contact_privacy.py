from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User

from .models import ContactMessage, MunicipalService, StaffAuditEvent


class ContactPrivacyF51Tests(APITestCase):
    def setUp(self):
        self.citizen = User.objects.create_user(
            email="privacy-citizen@example.com", password="StrongPass123!",
            role=User.Role.CITIZEN, email_verified=True, is_active=True,
            first_name="Lina", last_name="Nova",
        )
        self.agent = User.objects.create_user(
            email="privacy-agent@example.com", password="StrongPass123!",
            role=User.Role.AGENT, email_verified=True, is_active=True,
        )
        self.admin = User.objects.create_user(
            email="privacy-admin@example.com", password="StrongPass123!",
            role=User.Role.ADMIN, email_verified=True, is_active=True,
        )
        self.service = MunicipalService.objects.create(
            name="Administration F51", slug="administration-f51",
            short_description="Administration", is_active=True,
        )

    def _payload(self, category="privacy"):
        return {
            "category": category,
            "name": "Lina Nova",
            "email": self.citizen.email,
            "service": self.service.pk,
            "subject": "Utilisation de mes données",
            "message": "Je souhaite comprendre comment mes données sont utilisées.",
        }

    def test_privacy_contact_requires_authenticated_citizen(self):
        response = self.client.post(reverse("city:contact"), self._payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ContactMessage.objects.count(), 0)

    def test_citizen_creates_privacy_contact_with_trace_and_category(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.post(reverse("city:contact"), self._payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["request"]["category"], ContactMessage.Category.PRIVACY)
        message = ContactMessage.objects.get()
        self.assertEqual(message.category, ContactMessage.Category.PRIVACY)
        self.assertEqual(message.user, self.citizen)
        self.assertTrue(message.reference.startswith("NT-C"))

        history = self.client.get(reverse("city:citizen-contact-list"), {"category": "privacy"})
        self.assertEqual(history.status_code, status.HTTP_200_OK)
        self.assertEqual(len(history.data), 1)
        self.assertEqual(history.data[0]["reference"], message.reference)
        self.assertEqual(history.data[0]["category"], "privacy")

    def test_agent_cannot_list_or_open_privacy_contact(self):
        private = ContactMessage.objects.create(
            category=ContactMessage.Category.PRIVACY,
            user=self.citizen,
            name="Lina Nova", email=self.citizen.email,
            subject="Privé", message="Données personnelles",
        )
        general = ContactMessage.objects.create(
            category=ContactMessage.Category.GENERAL,
            user=self.citizen,
            name="Lina Nova", email=self.citizen.email,
            subject="Général", message="Question générale",
        )
        self.client.force_authenticate(self.agent)
        listing = self.client.get(reverse("city:agent-contact-list"))
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        refs = {row["reference"] for row in listing.data}
        self.assertIn(general.reference, refs)
        self.assertNotIn(private.reference, refs)

        filtered = self.client.get(reverse("city:agent-contact-list"), {"category": "privacy"})
        self.assertEqual(filtered.status_code, status.HTTP_200_OK)
        self.assertEqual(len(filtered.data), 0)

        detail = self.client.get(reverse("city:agent-contact-detail", kwargs={"reference": private.reference}))
        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_can_filter_privacy_contacts(self):
        private = ContactMessage.objects.create(
            category=ContactMessage.Category.PRIVACY,
            user=self.citizen,
            name="Lina Nova", email=self.citizen.email,
            subject="Privé", message="Données personnelles",
        )
        ContactMessage.objects.create(
            category=ContactMessage.Category.GENERAL,
            user=self.citizen,
            name="Lina Nova", email=self.citizen.email,
            subject="Général", message="Question générale",
        )
        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse("city:admin-contact-list"), {"category": "privacy"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["reference"], private.reference)
        self.assertEqual(response.data[0]["category"], "privacy")

    def test_privacy_contact_can_only_be_assigned_to_admin(self):
        private = ContactMessage.objects.create(
            category=ContactMessage.Category.PRIVACY,
            user=self.citizen,
            name="Lina Nova", email=self.citizen.email,
            subject="Privé", message="Données personnelles",
        )
        url = reverse("city:admin-contact-detail", kwargs={"reference": private.reference})
        self.client.force_authenticate(self.admin)
        denied = self.client.patch(url, {"assigned_to": self.agent.pk}, format="json")
        self.assertEqual(denied.status_code, status.HTTP_400_BAD_REQUEST)

        allowed = self.client.patch(
            url,
            {"assigned_to": self.admin.pk, "status": ContactMessage.Status.READ},
            format="json",
        )
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        private.refresh_from_db()
        self.assertEqual(private.assigned_to, self.admin)
        audit = StaffAuditEvent.objects.filter(
            resource_type="contact_message", resource_reference=private.reference
        ).latest("created_at")
        self.assertEqual(audit.visibility, StaffAuditEvent.Visibility.ADMIN)

    def test_general_contact_behavior_is_unchanged(self):
        response = self.client.post(
            reverse("city:contact"),
            {
                "name": "Public User",
                "email": "public@example.com",
                "subject": "Question générale",
                "message": "Bonjour",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        message = ContactMessage.objects.get()
        self.assertEqual(message.category, ContactMessage.Category.GENERAL)

        self.client.force_authenticate(self.agent)
        listing = self.client.get(reverse("city:agent-contact-list"))
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(len(listing.data), 1)
