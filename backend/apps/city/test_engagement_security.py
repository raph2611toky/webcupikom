from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User

from .models import (
    CitizenAppointment,
    CitizenRequest,
    CitizenRequestSupport,
    MunicipalService,
    PrivacyConcern,
    ServiceFeedback,
    StaffAuditEvent,
)


class CitizenEngagementSecurityTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner-engagement@example.com",
            password="StrongPass123!",
            role=User.Role.CITIZEN,
            email_verified=True,
            is_active=True,
            district="Nova Nord",
        )
        self.citizen = User.objects.create_user(
            email="supporter-engagement@example.com",
            password="StrongPass123!",
            role=User.Role.CITIZEN,
            email_verified=True,
            is_active=True,
            district="Nova Sud",
        )
        self.other = User.objects.create_user(
            email="other-engagement@example.com",
            password="StrongPass123!",
            role=User.Role.CITIZEN,
            email_verified=True,
            is_active=True,
        )
        self.agent = User.objects.create_user(
            email="agent-engagement@example.com",
            password="StrongPass123!",
            role=User.Role.AGENT,
            email_verified=True,
            is_active=True,
        )
        self.admin = User.objects.create_user(
            email="admin-engagement@example.com",
            password="StrongPass123!",
            role=User.Role.ADMIN,
            email_verified=True,
            is_active=True,
        )
        self.service = MunicipalService.objects.create(
            name="Voirie",
            slug="voirie-engagement",
            category="Cadre de vie",
            short_description="Interventions de voirie",
            is_active=True,
        )
        self.report = CitizenRequest.objects.create(
            citizen=self.owner,
            service=self.service,
            request_type=CitizenRequest.RequestType.REPORT,
            incident_category="road_damage",
            title="Chez Mme Exemple, trou devant le portail privé",
            description="Description très précise qui ne doit jamais être exposée au public.",
            location_text="12 rue privée, porte bleue",
            latitude="-18.910000",
            longitude="47.520000",
            district="Nova Nord",
            street="Rue privée",
            building="Maison 12",
            contact_phone="+261340000000",
            status=CitizenRequest.Status.IN_PROGRESS,
        )

    def test_f52_supportable_list_redacts_owner_and_precise_payload(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.get(reverse("city:citizen-supportable-request-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        item = response.data[0]
        self.assertEqual(item["reference"], self.report.reference)
        self.assertNotIn("citizen", item)
        self.assertNotIn("citizen_email", item)
        self.assertNotIn("description", item)
        self.assertNotIn("location_text", item)
        self.assertNotIn("latitude", item)
        self.assertNotIn("longitude", item)
        self.assertNotIn("street", item)
        self.assertNotIn("building", item)
        self.assertNotEqual(item["public_title"], self.report.title)

    def test_f52_support_is_idempotent_and_owner_cannot_support_own_request(self):
        url = reverse("city:citizen-request-support", kwargs={"reference": self.report.reference})
        self.client.force_authenticate(self.citizen)
        first = self.client.post(url, {}, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertTrue(first.data["supported"])
        self.assertEqual(first.data["support_count"], 1)
        second = self.client.post(url, {}, format="json")
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(CitizenRequestSupport.objects.filter(request=self.report).count(), 1)

        self.client.force_authenticate(self.owner)
        own = self.client.post(url, {}, format="json")
        self.assertEqual(own.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(CitizenRequestSupport.objects.filter(request=self.report).count(), 1)

    def test_f52_private_procedure_and_duplicate_are_not_supportable(self):
        procedure = CitizenRequest.objects.create(
            citizen=self.owner,
            service=self.service,
            request_type=CitizenRequest.RequestType.PROCEDURE,
            title="Démarche personnelle",
            description="Privé",
            status=CitizenRequest.Status.PENDING,
        )
        duplicate = CitizenRequest.objects.create(
            citizen=self.owner,
            service=self.service,
            request_type=CitizenRequest.RequestType.REPORT,
            title="Doublon",
            description="Doublon",
            location_text="Nova Nord",
            status=CitizenRequest.Status.PENDING,
            duplicate_of=self.report,
        )
        self.client.force_authenticate(self.citizen)
        listing = self.client.get(reverse("city:citizen-supportable-request-list"))
        refs = {row["reference"] for row in listing.data}
        self.assertNotIn(procedure.reference, refs)
        self.assertNotIn(duplicate.reference, refs)

        duplicate_support = self.client.post(
            reverse("city:citizen-request-support", kwargs={"reference": duplicate.reference}),
            {},
            format="json",
        )
        self.assertEqual(duplicate_support.status_code, status.HTTP_404_NOT_FOUND)

    def test_f52_closed_request_rejects_new_support_but_existing_support_can_be_removed(self):
        url = reverse("city:citizen-request-support", kwargs={"reference": self.report.reference})
        self.client.force_authenticate(self.citizen)
        self.assertEqual(self.client.post(url, {}, format="json").status_code, status.HTTP_201_CREATED)
        self.report.status = CitizenRequest.Status.COMPLETED
        self.report.save(update_fields=("status", "updated_at"))

        self.client.force_authenticate(self.other)
        rejected = self.client.post(url, {}, format="json")
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.citizen)
        removed = self.client.delete(url)
        self.assertEqual(removed.status_code, status.HTTP_200_OK)
        self.assertFalse(removed.data["supported"])

    def test_request_owner_and_agent_can_see_aggregate_support_count_not_supporter_identity(self):
        CitizenRequestSupport.objects.create(request=self.report, citizen=self.citizen)
        self.client.force_authenticate(self.owner)
        own = self.client.get(reverse("city:citizen-request-detail", kwargs={"reference": self.report.reference}))
        self.assertEqual(own.status_code, status.HTTP_200_OK)
        self.assertEqual(own.data["support_count"], 1)
        self.assertNotIn("supporters", own.data)

        self.client.force_authenticate(self.agent)
        agent = self.client.get(reverse("city:agent-request-detail", kwargs={"reference": self.report.reference}))
        self.assertEqual(agent.status_code, status.HTTP_200_OK)
        self.assertEqual(agent.data["support_count"], 1)
        self.assertNotIn("supporters", agent.data)

    def test_f76_feedback_requires_verified_completed_usage(self):
        self.client.force_authenticate(self.citizen)
        url = reverse("city:citizen-service-feedback", kwargs={"slug": self.service.slug})
        denied = self.client.post(url, {"rating": 4, "comment": "Bon service."}, format="json")
        self.assertEqual(denied.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ServiceFeedback.objects.count(), 0)

        completed = CitizenRequest.objects.create(
            citizen=self.citizen,
            service=self.service,
            request_type=CitizenRequest.RequestType.PROCEDURE,
            title="Demande terminée",
            description="Usage vérifié",
            status=CitizenRequest.Status.COMPLETED,
        )
        created = self.client.post(
            url,
            {"rating": 5, "comment": "Réponse rapide.", "request_reference": completed.reference},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertTrue(created.data["verified_usage"])
        self.assertTrue(created.data["reference"].startswith("NT-AVIS-"))
        self.assertEqual(created.data["source_request_reference"], completed.reference)

    def test_f76_one_feedback_per_citizen_service_and_owner_can_patch_it(self):
        completed = CitizenRequest.objects.create(
            citizen=self.citizen,
            service=self.service,
            request_type=CitizenRequest.RequestType.PROCEDURE,
            title="Demande terminée",
            description="Usage vérifié",
            status=CitizenRequest.Status.COMPLETED,
        )
        self.client.force_authenticate(self.citizen)
        url = reverse("city:citizen-service-feedback", kwargs={"slug": self.service.slug})
        self.assertEqual(
            self.client.post(url, {"rating": 4, "request_reference": completed.reference}, format="json").status_code,
            status.HTTP_201_CREATED,
        )
        duplicate = self.client.post(url, {"rating": 3}, format="json")
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        updated = self.client.patch(url, {"rating": 5, "comment": "Mieux que prévu."}, format="json")
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["rating"], 5)
        self.assertEqual(ServiceFeedback.objects.filter(citizen=self.citizen, service=self.service).count(), 1)

    def test_f76_completed_appointment_is_also_valid_usage_proof(self):
        appointment = CitizenAppointment.objects.create(
            citizen=self.citizen,
            agent=self.agent,
            service=self.service,
            starts_at=timezone.now() - timedelta(hours=2),
            ends_at=timezone.now() - timedelta(hours=1),
            reason="Accueil voirie",
            status=CitizenAppointment.Status.COMPLETED,
        )
        self.client.force_authenticate(self.citizen)
        response = self.client.post(
            reverse("city:citizen-service-feedback", kwargs={"slug": self.service.slug}),
            {"rating": 4, "appointment_reference": appointment.reference},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["source_appointment_reference"], appointment.reference)

    def test_f76_feedback_admin_list_is_admin_only(self):
        completed = CitizenRequest.objects.create(
            citizen=self.citizen,
            service=self.service,
            request_type=CitizenRequest.RequestType.PROCEDURE,
            title="Usage",
            description="Terminé",
            status=CitizenRequest.Status.COMPLETED,
        )
        ServiceFeedback.objects.create(
            citizen=self.citizen,
            service=self.service,
            source_request=completed,
            rating=5,
            comment="Très bien",
        )
        url = reverse("city:admin-service-feedback-list")
        self.client.force_authenticate(self.agent)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.admin)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_f51_privacy_concern_is_traceable_private_and_admin_only_for_staff(self):
        self.client.force_authenticate(self.citizen)
        list_url = reverse("city:citizen-privacy-concern-list")
        created = self.client.post(
            list_url,
            {
                "topic": "data_usage",
                "subject": "Je veux comprendre l'utilisation de mes données",
                "message": "Je souhaite savoir quelles informations sont utilisées pour personnaliser mon espace.",
            },
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        reference = created.data["reference"]
        self.assertTrue(reference.startswith("NT-PRIV-"))
        self.assertIn(reference, created.data["confirmation"])

        self.client.force_authenticate(self.other)
        other_detail = self.client.get(reverse("city:citizen-privacy-concern-detail", kwargs={"reference": reference}))
        self.assertEqual(other_detail.status_code, status.HTTP_404_NOT_FOUND)

        admin_list = reverse("city:admin-privacy-concern-list")
        self.client.force_authenticate(self.agent)
        self.assertEqual(self.client.get(admin_list).status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(admin_list).status_code, status.HTTP_200_OK)
        updated = self.client.patch(
            reverse("city:admin-privacy-concern-detail", kwargs={"reference": reference}),
            {"status": "in_review", "admin_note": "Analyse confidentielle en cours."},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        concern = PrivacyConcern.objects.get(reference=reference)
        self.assertEqual(concern.handled_by, self.admin)
        self.assertTrue(
            StaffAuditEvent.objects.filter(
                action="privacy_concern.update",
                resource_reference=reference,
                visibility=StaffAuditEvent.Visibility.ADMIN,
            ).exists()
        )
