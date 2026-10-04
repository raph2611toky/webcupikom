from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User

from .models import CitizenRequest, CitizenRequestSupport, MunicipalService


class RequestSupportF52IndependentTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="f52-owner@example.com", password="StrongPass123!",
            role=User.Role.CITIZEN, email_verified=True, is_active=True,
        )
        self.supporter = User.objects.create_user(
            email="f52-supporter@example.com", password="StrongPass123!",
            role=User.Role.CITIZEN, email_verified=True, is_active=True,
        )
        self.agent = User.objects.create_user(
            email="f52-agent@example.com", password="StrongPass123!",
            role=User.Role.AGENT, email_verified=True, is_active=True,
        )
        self.service = MunicipalService.objects.create(
            name="Voirie F52", slug="voirie-f52-independent",
            short_description="Voirie", is_active=True,
        )
        self.report = CitizenRequest.objects.create(
            citizen=self.owner,
            service=self.service,
            request_type=CitizenRequest.RequestType.REPORT,
            incident_category="road_damage",
            title="Adresse privée à ne pas exposer",
            description="Description détaillée et privée.",
            location_text="12 rue privée",
            district="Nova Nord",
            street="Rue privée",
            building="12",
            contact_phone="+261340000000",
            latitude="-18.910000",
            longitude="47.520000",
            status=CitizenRequest.Status.IN_PROGRESS,
        )

    def test_public_anonymized_listing_requires_no_authentication(self):
        response = self.client.get(reverse("city:citizen-supportable-request-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        item = response.data[0]
        self.assertEqual(item["reference"], self.report.reference)
        self.assertFalse(item["can_support"])
        for forbidden in (
            "citizen", "citizen_name", "citizen_email", "description",
            "location_text", "latitude", "longitude", "street", "building",
            "contact_phone", "attachments", "timeline",
        ):
            self.assertNotIn(forbidden, item)
        self.assertNotEqual(item["public_title"], self.report.title)

    def test_authenticated_citizen_can_support_and_remove_idempotently(self):
        url = reverse("city:citizen-request-support", kwargs={"reference": self.report.reference})
        self.client.force_authenticate(self.supporter)
        first = self.client.post(url, {}, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertTrue(first.data["supported"])
        self.assertEqual(first.data["support_count"], 1)

        second = self.client.post(url, {}, format="json")
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(CitizenRequestSupport.objects.filter(request=self.report).count(), 1)

        removed = self.client.delete(url)
        self.assertEqual(removed.status_code, status.HTTP_200_OK)
        self.assertFalse(removed.data["supported"])
        self.assertEqual(removed.data["support_count"], 0)

    def test_owner_cannot_support_own_request(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            reverse("city:citizen-request-support", kwargs={"reference": self.report.reference}),
            {}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(CitizenRequestSupport.objects.count(), 0)

    def test_agent_can_browse_anonymized_list_but_cannot_support(self):
        self.client.force_authenticate(self.agent)
        listing = self.client.get(reverse("city:citizen-supportable-request-list"))
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertFalse(listing.data[0]["can_support"])

        action = self.client.post(
            reverse("city:citizen-request-support", kwargs={"reference": self.report.reference}),
            {}, format="json",
        )
        self.assertEqual(action.status_code, status.HTTP_403_FORBIDDEN)

    def test_private_procedure_duplicate_and_closed_report_are_not_publicly_supportable(self):
        CitizenRequest.objects.create(
            citizen=self.owner, service=self.service,
            request_type=CitizenRequest.RequestType.PROCEDURE,
            title="Démarche privée", description="Privé",
            status=CitizenRequest.Status.PENDING,
        )
        duplicate = CitizenRequest.objects.create(
            citizen=self.owner, service=self.service,
            request_type=CitizenRequest.RequestType.REPORT,
            title="Doublon", description="Doublon",
            status=CitizenRequest.Status.PENDING,
            duplicate_of=self.report,
        )
        closed = CitizenRequest.objects.create(
            citizen=self.owner, service=self.service,
            request_type=CitizenRequest.RequestType.REPORT,
            title="Clos", description="Clos",
            status=CitizenRequest.Status.COMPLETED,
        )
        response = self.client.get(reverse("city:citizen-supportable-request-list"))
        refs = {row["reference"] for row in response.data}
        self.assertIn(self.report.reference, refs)
        self.assertNotIn(duplicate.reference, refs)
        self.assertNotIn(closed.reference, refs)

    def test_support_counter_is_aggregate_only(self):
        CitizenRequestSupport.objects.create(request=self.report, citizen=self.supporter)
        self.client.force_authenticate(self.owner)
        response = self.client.get(
            reverse("city:citizen-request-detail", kwargs={"reference": self.report.reference})
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["support_count"], 1)
        self.assertNotIn("supporters", response.data)
        self.assertNotIn("supporter_emails", response.data)
