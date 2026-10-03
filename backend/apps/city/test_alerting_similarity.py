from unittest.mock import patch
from datetime import timedelta

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.users.auth_cookies import build_refresh_token
from apps.users.models import User

from .models import CitizenRequest, MunicipalService, NewsArticle
from .services.news import deliver_news


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AlertingFlowRegressionTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="alerts-admin@example.com", password="StrongPass!2026",
            role=User.Role.ADMIN, email_verified=True,
        )
        self.south = User.objects.create_user(
            email="alerts-south@example.com", password="StrongPass!2026",
            role=User.Role.CITIZEN, district="Sud", email_verified=True,
        )
        self.south2 = User.objects.create_user(
            email="alerts-south2@example.com", password="StrongPass!2026",
            role=User.Role.CITIZEN, district="Sud", email_verified=True,
        )

    def test_exact_batch_size_completes_and_alert_schedules_immediate_email(self):
        article = NewsArticle.objects.create(
            title="Alerte eau",
            slug="alerte-eau",
            content="Montée du niveau de l'eau.",
            publication_type="alert",
            severity="critical",
            is_published=True,
            target_districts=["sud"],
            affected_areas="Quartier Sud",
            instructions="Évitez les zones basses.",
            source_name="Centre de surveillance",
            expires_at=timezone.now() + timedelta(hours=4),
            author=self.admin,
        )
        with patch("apps.city.services.notifications.dispatch_due_notification_emails") as dispatch:
            with self.captureOnCommitCallbacks(execute=True):
                delivered = deliver_news(article.pk, limit=2)
        self.assertEqual(delivered, 2)
        article.refresh_from_db()
        self.assertIsNotNone(article.delivery_completed_at)
        self.assertEqual(article.notifications.count(), 2)
        dispatch.assert_called_once_with(notification_code=f"news:{article.pk}", limit=2)

    def test_alert_custom_action_is_copied_to_citizen_notification(self):
        article = NewsArticle.objects.create(
            title="Consigne d'urgence",
            slug="consigne-urgence",
            content="Information municipale.",
            publication_type="alert",
            severity="critical",
            is_published=True,
            target_districts=["sud"],
            affected_areas="Quartier Sud",
            instructions="Suivez les consignes.",
            source_name="Mairie",
            expires_at=timezone.now() + timedelta(hours=2),
            action_label="Voir le plan officiel",
            action_url="https://example.com/plan-officiel",
            author=self.admin,
        )
        with patch("apps.city.services.notifications.dispatch_due_notification_emails"):
            with self.captureOnCommitCallbacks(execute=True):
                deliver_news(article.pk, limit=10)
        notice = article.notifications.get(user=self.south)
        self.assertEqual(notice.action_label, "Voir le plan officiel")
        self.assertEqual(notice.action_url, "https://example.com/plan-officiel")
        self.assertTrue(notice.is_important)


class SimilarRequestF75Tests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="f75-admin@example.com", password="StrongPass!2026",
            role=User.Role.ADMIN, email_verified=True,
        )
        self.agent = User.objects.create_user(
            email="f75-agent@example.com", password="StrongPass!2026",
            role=User.Role.AGENT, email_verified=True,
        )
        self.citizen = User.objects.create_user(
            email="f75-citizen@example.com", password="StrongPass!2026",
            role=User.Role.CITIZEN, email_verified=True,
        )
        self.other = User.objects.create_user(
            email="f75-other@example.com", password="StrongPass!2026",
            role=User.Role.CITIZEN, email_verified=True,
        )
        self.service = MunicipalService.objects.create(
            name="Éclairage public", slug="eclairage-f75",
            short_description="Gestion de l'éclairage public",
        )
        self.source = self.report(
            citizen=self.citizen,
            title="Lampadaire cassé rue des Fleurs",
            description="Le lampadaire devant le numéro 12 ne fonctionne plus depuis hier soir.",
            district="Nova Sud", location_text="12 rue des Fleurs",
            latitude="-18.910000", longitude="47.520000",
        )
        self.similar = self.report(
            citizen=self.other,
            title="Lampadaire en panne rue des Fleurs",
            description="Éclairage public hors service près du numéro 12 depuis la nuit dernière.",
            district="Nova Sud", location_text="Rue des Fleurs numéro 12",
            latitude="-18.910200", longitude="47.520100",
        )
        self.report(
            citizen=self.other,
            title="Déchets près du marché",
            description="Des sacs poubelles sont déposés près du marché central.",
            incident_category="waste", district="Nova Nord",
            location_text="Marché central",
        )

    def auth(self, user):
        token = build_refresh_token(user, remember=False)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + str(token.access_token))

    def report(self, *, citizen, title, description, incident_category="street_lighting", district="", location_text="", latitude=None, longitude=None):
        return CitizenRequest.objects.create(
            citizen=citizen,
            service=self.service if incident_category == "street_lighting" else None,
            request_type=CitizenRequest.RequestType.REPORT,
            incident_category=incident_category,
            title=title,
            description=description,
            district=district,
            location_text=location_text,
            latitude=latitude,
            longitude=longitude,
            status=CitizenRequest.Status.PENDING,
        )

    def test_agent_gets_ranked_similar_requests(self):
        self.auth(self.agent)
        response = self.client.get(f"/api/agent/requests/{self.source.reference}/similar/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertGreaterEqual(response.data["count"], 1)
        first = response.data["results"][0]
        self.assertEqual(first["reference"], self.similar.reference)
        self.assertGreaterEqual(first["similarity_percent"], 42)
        self.assertIn("Même catégorie", first["reasons"])
        self.assertIn("Même quartier", first["reasons"])

    def test_mark_duplicate_uses_existing_patch_and_exposes_reference(self):
        self.auth(self.agent)
        response = self.client.patch(
            f"/api/agent/requests/{self.source.reference}/",
            {"duplicate_of": self.similar.pk},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["is_duplicate"])
        self.assertEqual(response.data["duplicate_of"], self.similar.pk)
        self.assertEqual(response.data["duplicate_of_reference"], self.similar.reference)

    def test_duplicate_cycle_is_rejected(self):
        self.similar.duplicate_of = self.source
        self.similar.save(update_fields=["duplicate_of"])
        self.auth(self.agent)
        response = self.client.patch(
            f"/api/agent/requests/{self.source.reference}/",
            {"duplicate_of": self.similar.pk},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)

    def test_duplicate_filter_and_admin_endpoint_permissions(self):
        self.source.duplicate_of = self.similar
        self.source.save(update_fields=["duplicate_of"])
        self.auth(self.agent)
        response = self.client.get("/api/agent/requests/?duplicate=true")
        self.assertEqual(response.status_code, 200, response.data)
        references = [item["reference"] for item in response.data["results"]]
        self.assertIn(self.source.reference, references)
        self.assertNotIn(self.similar.reference, references)
        self.assertEqual(
            self.client.get(f"/api/admin/requests/{self.source.reference}/similar/").status_code,
            403,
        )
        self.auth(self.admin)
        self.assertEqual(
            self.client.get(f"/api/admin/requests/{self.source.reference}/similar/").status_code,
            200,
        )

    def test_similarity_is_report_only(self):
        procedure = CitizenRequest.objects.create(
            citizen=self.citizen,
            request_type=CitizenRequest.RequestType.PROCEDURE,
            title="Demande de document",
            description="Une démarche administrative classique.",
        )
        self.auth(self.agent)
        response = self.client.get(f"/api/agent/requests/{procedure.reference}/similar/")
        self.assertEqual(response.status_code, 400, response.data)
