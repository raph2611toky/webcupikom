from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models.deletion import RestrictedError
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User

from .models import CitizenAppointment, CitizenRequest, MunicipalService, ServiceFeedback


class ServiceFeedbackF76Tests(APITestCase):
    """F76 isolé : avis uniquement après utilisation vérifiable d'un service."""

    def setUp(self):
        self.citizen = User.objects.create_user(
            email="f76-citizen@example.com",
            password="StrongPass123!",
            role=User.Role.CITIZEN,
            email_verified=True,
            is_active=True,
        )
        self.other = User.objects.create_user(
            email="f76-other@example.com",
            password="StrongPass123!",
            role=User.Role.CITIZEN,
            email_verified=True,
            is_active=True,
        )
        self.agent = User.objects.create_user(
            email="f76-agent@example.com",
            password="StrongPass123!",
            role=User.Role.AGENT,
            email_verified=True,
            is_active=True,
        )
        self.admin = User.objects.create_user(
            email="f76-admin@example.com",
            password="StrongPass123!",
            role=User.Role.ADMIN,
            email_verified=True,
            is_active=True,
        )
        self.service = MunicipalService.objects.create(
            name="Accueil citoyen F76",
            slug="accueil-citoyen-f76",
            category="Administration",
            short_description="Service de test F76",
            is_active=True,
        )
        self.url = reverse("city:citizen-service-feedback", kwargs={"slug": self.service.slug})

    def _completed_request(self, user=None):
        return CitizenRequest.objects.create(
            citizen=user or self.citizen,
            service=self.service,
            request_type=CitizenRequest.RequestType.PROCEDURE,
            title="Démarche terminée F76",
            description="Utilisation vérifiable du service.",
            status=CitizenRequest.Status.COMPLETED,
        )

    def _completed_appointment(self, user=None):
        return CitizenAppointment.objects.create(
            citizen=user or self.citizen,
            agent=self.agent,
            service=self.service,
            starts_at=timezone.now() - timedelta(hours=2),
            ends_at=timezone.now() - timedelta(hours=1),
            reason="Rendez-vous F76",
            status=CitizenAppointment.Status.COMPLETED,
        )

    def test_get_state_without_usage_is_not_eligible(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["eligible"])
        self.assertFalse(response.data["can_create"])
        self.assertFalse(response.data["can_update"])
        self.assertIsNone(response.data["feedback"])

    def test_completed_request_makes_feedback_creatable(self):
        completed = self._completed_request()
        self.client.force_authenticate(self.citizen)
        state = self.client.get(self.url)
        self.assertTrue(state.data["eligible"])
        self.assertTrue(state.data["can_create"])
        self.assertFalse(state.data["can_update"])
        self.assertEqual(state.data["eligible_sources"][0]["reference"], completed.reference)

        created = self.client.post(
            self.url,
            {"rating": 5, "comment": "Très bon accueil.", "request_reference": completed.reference},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertTrue(created.data["verified_usage"])
        self.assertEqual(created.data["source_request_reference"], completed.reference)
        self.assertTrue(created.data["reference"].startswith("NT-AVIS-"))

        state = self.client.get(self.url)
        self.assertTrue(state.data["eligible"])
        self.assertFalse(state.data["can_create"])
        self.assertTrue(state.data["can_update"])

    def test_cannot_use_another_citizens_completed_request_as_proof(self):
        other_request = self._completed_request(user=self.other)
        self.client.force_authenticate(self.citizen)
        response = self.client.post(
            self.url,
            {"rating": 4, "request_reference": other_request.reference},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ServiceFeedback.objects.count(), 0)

    def test_completed_appointment_is_valid_proof(self):
        appointment = self._completed_appointment()
        self.client.force_authenticate(self.citizen)
        response = self.client.post(
            self.url,
            {"rating": 4, "appointment_reference": appointment.reference},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["source_appointment_reference"], appointment.reference)

    def test_feedback_is_unique_and_double_post_is_cleanly_rejected(self):
        completed = self._completed_request()
        self.client.force_authenticate(self.citizen)
        first = self.client.post(
            self.url,
            {"rating": 4, "request_reference": completed.reference},
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        second = self.client.post(self.url, {"rating": 5}, format="json")
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ServiceFeedback.objects.filter(citizen=self.citizen, service=self.service).count(), 1)

    def test_only_owner_can_patch_and_usage_source_is_immutable(self):
        completed = self._completed_request()
        self.client.force_authenticate(self.citizen)
        self.client.post(
            self.url,
            {"rating": 3, "request_reference": completed.reference},
            format="json",
        )
        updated = self.client.patch(self.url, {"rating": 5, "comment": "Avis corrigé."}, format="json")
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["rating"], 5)

        forbidden_source_change = self.client.patch(
            self.url,
            {"request_reference": completed.reference},
            format="json",
        )
        self.assertEqual(forbidden_source_change.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.other)
        other_patch = self.client.patch(self.url, {"rating": 1}, format="json")
        self.assertEqual(other_patch.status_code, status.HTTP_404_NOT_FOUND)

    def test_rating_and_comment_limits_are_enforced(self):
        completed = self._completed_request()
        self.client.force_authenticate(self.citizen)
        too_low = self.client.post(
            self.url,
            {"rating": 0, "request_reference": completed.reference},
            format="json",
        )
        self.assertEqual(too_low.status_code, status.HTTP_400_BAD_REQUEST)
        too_long = self.client.post(
            self.url,
            {"rating": 5, "comment": "x" * 3001, "request_reference": completed.reference},
            format="json",
        )
        self.assertEqual(too_long.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ServiceFeedback.objects.count(), 0)

    def test_citizen_endpoint_rejects_staff_and_admin_list_rejects_agent(self):
        self._completed_request()
        self.client.force_authenticate(self.agent)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)
        admin_url = reverse("city:admin-service-feedback-list")
        self.assertEqual(self.client.get(admin_url).status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(admin_url).status_code, status.HTTP_200_OK)


    def test_usage_source_cannot_be_deleted_while_feedback_exists(self):
        completed = self._completed_request()
        feedback = ServiceFeedback.objects.create(
            citizen=self.citizen,
            service=self.service,
            source_request=completed,
            rating=5,
        )
        with self.assertRaises(RestrictedError):
            completed.delete()
        feedback.delete()
        completed.delete()
        self.assertFalse(CitizenRequest.objects.filter(pk=completed.pk).exists())

    def test_database_requires_exactly_one_usage_source(self):
        request = self._completed_request()
        appointment = self._completed_appointment()

        # Le modèle lui-même refuse déjà ces créations directes.
        with self.assertRaises(DjangoValidationError):
            ServiceFeedback.objects.create(
                citizen=self.citizen,
                service=self.service,
                rating=4,
            )
        with self.assertRaises(DjangoValidationError):
            ServiceFeedback.objects.create(
                citizen=self.citizen,
                service=self.service,
                source_request=request,
                source_appointment=appointment,
                rating=4,
            )

        # Et la base possède aussi une contrainte XOR, utile si validation ORM contournée.
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                ServiceFeedback.objects.bulk_create([
                    ServiceFeedback(
                        reference="NT-AVIS-2026-INVALID",
                        citizen=self.citizen,
                        service=self.service,
                        rating=4,
                    )
                ])
