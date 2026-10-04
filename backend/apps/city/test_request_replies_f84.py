from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User

from .models import CitizenNotification, CitizenRequest, CitizenRequestEvent, MunicipalService, StaffAuditEvent


class RequestRepliesF84Tests(APITestCase):
    def setUp(self):
        self.citizen = User.objects.create_user(
            email="f84-citizen@example.com",
            password="StrongPass123!",
            role=User.Role.CITIZEN,
            email_verified=True,
            is_active=True,
        )
        self.other_citizen = User.objects.create_user(
            email="f84-other@example.com",
            password="StrongPass123!",
            role=User.Role.CITIZEN,
            email_verified=True,
            is_active=True,
        )
        self.agent = User.objects.create_user(
            email="f84-agent@example.com",
            password="StrongPass123!",
            role=User.Role.AGENT,
            email_verified=True,
            is_active=True,
        )
        self.admin = User.objects.create_user(
            email="f84-admin@example.com",
            password="StrongPass123!",
            role=User.Role.ADMIN,
            email_verified=True,
            is_active=True,
        )
        self.service = MunicipalService.objects.create(
            name="Service F84",
            slug="service-f84",
            short_description="Réponses F84",
            is_active=True,
        )
        self.request_item = CitizenRequest.objects.create(
            citizen=self.citizen,
            service=self.service,
            request_type=CitizenRequest.RequestType.PROCEDURE,
            title="Demande de document",
            description="Je souhaite connaître la suite de ma démarche.",
            status=CitizenRequest.Status.PENDING,
        )

    def agent_reply_url(self, item=None):
        item = item or self.request_item
        return reverse("city:agent-request-replies", kwargs={"reference": item.reference})

    def citizen_reply_url(self, item=None):
        item = item or self.request_item
        return reverse("city:citizen-request-replies", kwargs={"reference": item.reference})

    def test_agent_can_reply_to_procedure_and_citizen_is_notified(self):
        self.client.force_authenticate(self.agent)
        response = self.client.post(
            self.agent_reply_url(),
            {"message": "Votre dossier est complet. Le document sera disponible demain."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["event_type"], CitizenRequestEvent.EventType.REPLY)
        self.assertTrue(response.data["is_public"])
        self.assertEqual(response.data["actor_role"], User.Role.AGENT)

        reply = CitizenRequestEvent.objects.get(pk=response.data["id"])
        self.assertEqual(reply.request, self.request_item)
        self.assertEqual(reply.actor, self.agent)
        self.assertEqual(reply.title, "Réponse de l’équipe municipale")

        self.request_item.refresh_from_db()
        self.assertIsNotNone(self.request_item.acknowledged_at)
        self.assertTrue(
            CitizenNotification.objects.filter(
                user=self.citizen,
                sender=self.agent,
                related_request=self.request_item,
                title__startswith="Réponse à votre demande",
            ).exists()
        )
        self.assertTrue(
            StaffAuditEvent.objects.filter(
                actor=self.agent,
                action="request.reply",
                resource_reference=self.request_item.reference,
            ).exists()
        )

        detail = self.client.get(
            reverse("city:agent-request-detail", kwargs={"reference": self.request_item.reference})
        )
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertIn("reply_to_citizen", detail.data["available_actions"])
        self.assertTrue(detail.data["has_agent_reply"])
        self.assertEqual(detail.data["agent_reply_count"], 1)

    def test_citizen_sees_only_public_replies_for_own_request(self):
        CitizenRequestEvent.objects.create(
            request=self.request_item,
            actor=self.agent,
            event_type=CitizenRequestEvent.EventType.REPLY,
            title="Réponse de l’équipe municipale",
            message="Réponse visible",
            is_public=True,
        )
        CitizenRequestEvent.objects.create(
            request=self.request_item,
            actor=self.agent,
            event_type=CitizenRequestEvent.EventType.NOTE,
            title="Note interne",
            message="Information interne",
            is_public=False,
        )

        self.client.force_authenticate(self.citizen)
        response = self.client.get(self.citizen_reply_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["message"], "Réponse visible")
        self.assertNotContains(response, "Information interne")

        self.client.force_authenticate(self.other_citizen)
        other = self.client.get(self.citizen_reply_url())
        self.assertEqual(other.status_code, status.HTTP_200_OK)
        self.assertEqual(other.data["count"], 0)

    def test_citizen_cannot_use_agent_reply_endpoint(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.post(
            self.agent_reply_url(), {"message": "Je tente de répondre comme agent."}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(
            CitizenRequestEvent.objects.filter(event_type=CitizenRequestEvent.EventType.REPLY).exists()
        )

    def test_agent_reply_list_filter_exposes_answered_state(self):
        answered = self.request_item
        unanswered = CitizenRequest.objects.create(
            citizen=self.citizen,
            service=self.service,
            request_type=CitizenRequest.RequestType.PROCEDURE,
            title="Deuxième demande",
            description="Encore sans réponse.",
            status=CitizenRequest.Status.PENDING,
        )
        CitizenRequestEvent.objects.create(
            request=answered,
            actor=self.agent,
            event_type=CitizenRequestEvent.EventType.REPLY,
            title="Réponse de l’équipe municipale",
            message="Réponse enregistrée",
            is_public=True,
        )

        self.client.force_authenticate(self.agent)
        with_reply = self.client.get(reverse("city:agent-request-list"), {"has_agent_reply": "true"})
        self.assertEqual(with_reply.status_code, status.HTTP_200_OK)
        refs = {row["reference"] for row in with_reply.data["results"]}
        self.assertIn(answered.reference, refs)
        self.assertNotIn(unanswered.reference, refs)
        row = next(row for row in with_reply.data["results"] if row["reference"] == answered.reference)
        self.assertTrue(row["has_agent_reply"])
        self.assertEqual(row["agent_reply_count"], 1)
        self.assertIsNotNone(row["last_agent_reply_at"])

        without_reply = self.client.get(reverse("city:agent-request-list"), {"has_agent_reply": "false"})
        refs = {row["reference"] for row in without_reply.data["results"]}
        self.assertIn(unanswered.reference, refs)
        self.assertNotIn(answered.reference, refs)

    def test_reply_is_visible_in_existing_timeline_for_backward_compatibility(self):
        self.client.force_authenticate(self.agent)
        created = self.client.post(
            self.agent_reply_url(), {"message": "Réponse compatible chronologie."}, format="json"
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(self.citizen)
        timeline = self.client.get(
            reverse("city:citizen-request-timeline", kwargs={"reference": self.request_item.reference})
        )
        self.assertEqual(timeline.status_code, status.HTTP_200_OK)
        self.assertIn(
            "Réponse compatible chronologie.",
            [event["message"] for event in timeline.data["results"]],
        )

    def test_cancelled_request_rejects_new_public_reply(self):
        self.request_item.status = CitizenRequest.Status.CANCELLED
        self.request_item.save(update_fields=["status", "updated_at"])
        self.client.force_authenticate(self.agent)
        response = self.client.post(
            self.agent_reply_url(), {"message": "Réponse après annulation."}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            CitizenRequestEvent.objects.filter(
                request=self.request_item, event_type=CitizenRequestEvent.EventType.REPLY
            ).exists()
        )

    def test_admin_uses_same_reply_channel(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse("city:admin-request-replies", kwargs={"reference": self.request_item.reference}),
            {"message": "Réponse de l'administration."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["actor_role"], User.Role.ADMIN)
        self.assertEqual(response.data["event_type"], CitizenRequestEvent.EventType.REPLY)
