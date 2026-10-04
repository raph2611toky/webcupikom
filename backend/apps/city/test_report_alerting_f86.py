from unittest.mock import patch

from django.core import mail
from django.core.management import call_command
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.users.models import User

from .models import CitizenNotification, CitizenRequest, ReportAlertDispatch


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    REALTIME_ENABLED=True,
    REPORT_EMAIL_FALLBACK_ENABLED=True,
    REPORT_EMAIL_FALLBACK_ALL_REPORTS=True,
)
class ReportAlertingF86Tests(APITestCase):
    def setUp(self):
        self.citizen = User.objects.create_user(
            email="f86-citizen@example.com",
            password="StrongPass!2026",
            role=User.Role.CITIZEN,
            email_verified=True,
        )
        self.agent = User.objects.create_user(
            email="f86-agent@example.com",
            password="StrongPass!2026",
            role=User.Role.AGENT,
            email_verified=True,
        )
        self.admin = User.objects.create_user(
            email="f86-admin@example.com",
            password="StrongPass!2026",
            role=User.Role.ADMIN,
            email_verified=True,
        )

    def create_report(self, **overrides):
        data = {
            "title": "Lampadaire cassé",
            "description": "Le lampadaire ne fonctionne plus.",
            "incident_category": "street_lighting",
            "location_text": "Rue principale",
            "severity": "moderate",
            "danger_present": False,
        }
        data.update(overrides)
        self.client.force_authenticate(self.citizen)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post("/api/citizen/reports/", data, format="json")

    def test_standard_report_keeps_normal_circuit_without_alert_outbox(self):
        response = self.create_report()
        self.assertEqual(response.status_code, 201, response.data)
        item = CitizenRequest.objects.get(pk=response.data["id"])
        self.assertEqual(item.handling_route, CitizenRequest.HandlingRoute.STANDARD)
        self.assertEqual(item.alert_status, CitizenRequest.AlertStatus.NONE)
        self.assertEqual(item.priority, CitizenRequest.Priority.NORMAL)
        self.assertFalse(ReportAlertDispatch.objects.filter(request=item).exists())

    def test_every_new_report_is_duplicated_to_staff_by_email(self):
        mail.outbox.clear()
        response = self.create_report(
            title="Coupure locale",
            description="Un incident doit être transmis aux équipes.",
        )
        self.assertEqual(response.status_code, 201, response.data)
        item = CitizenRequest.objects.get(pk=response.data["id"])
        notices = CitizenNotification.objects.filter(
            related_request=item, notification_code=f"report:new:{item.pk}"
        )
        self.assertEqual(notices.count(), 2)
        recipients = {message.to[0] for message in mail.outbox}
        self.assertIn(self.agent.email, recipients)
        self.assertIn(self.admin.email, recipients)

    def test_power_outage_is_automatically_priority(self):
        response = self.create_report(
            title="Panne électrique",
            description="Le secteur est sans courant.",
            incident_category="power_outage",
            severity="moderate",
        )
        self.assertEqual(response.status_code, 201, response.data)
        item = CitizenRequest.objects.get(pk=response.data["id"])
        self.assertEqual(item.handling_route, CitizenRequest.HandlingRoute.PRIORITY)
        self.assertEqual(item.priority, CitizenRequest.Priority.HIGH)

    @patch("apps.city.services.report_alerting.publish_event_now", return_value=True)
    def test_medical_emergency_enters_durable_emergency_circuit(self, publish):
        response = self.create_report(
            title="Urgence médicale",
            description="Une personne a besoin d'une assistance urgente.",
            incident_category="medical_emergency",
            severity="critical",
            danger_present=True,
        )
        self.assertEqual(response.status_code, 201, response.data)
        item = CitizenRequest.objects.get(pk=response.data["id"])
        self.assertEqual(item.handling_route, CitizenRequest.HandlingRoute.EMERGENCY)
        self.assertEqual(item.priority, CitizenRequest.Priority.URGENT)
        self.assertEqual(item.alert_status, CitizenRequest.AlertStatus.DISPATCHED)
        self.assertIsNotNone(item.alert_triggered_at)
        dispatch = ReportAlertDispatch.objects.get(request=item)
        self.assertEqual(dispatch.status, ReportAlertDispatch.Status.DISPATCHED)
        self.assertEqual(dispatch.attempts, 1)
        publish.assert_called_once()
        args = publish.call_args.kwargs
        self.assertEqual(args["event"], "staff.report_alert.created")
        self.assertEqual(args["payload"]["reference"], item.reference)

    @patch("apps.city.services.report_alerting.publish_event_now", return_value=False)
    def test_realtime_failure_never_loses_emergency_alert(self, publish):
        response = self.create_report(
            title="Danger immédiat",
            description="Danger sur la voie publique.",
            incident_category="immediate_danger",
            severity="critical",
        )
        self.assertEqual(response.status_code, 201, response.data)
        item = CitizenRequest.objects.get(pk=response.data["id"])
        dispatch = ReportAlertDispatch.objects.get(request=item)
        self.assertEqual(item.alert_status, CitizenRequest.AlertStatus.PENDING)
        self.assertEqual(dispatch.status, ReportAlertDispatch.Status.RETRY)
        self.assertEqual(dispatch.attempts, 1)
        self.assertTrue(dispatch.last_error)

        # Le HTTP reste la source de vérité : l'agent voit l'urgence même si Redis est tombé.
        self.client.force_authenticate(self.agent)
        listing = self.client.get("/api/agent/report-alerts/")
        self.assertEqual(listing.status_code, 200, listing.data)
        refs = [row["reference"] for row in listing.data["results"]]
        self.assertIn(item.reference, refs)
        publish.assert_called_once()

    @patch("apps.city.services.report_alerting.publish_event_now", return_value=False)
    def test_retry_command_redelivers_pending_alert(self, first_publish):
        response = self.create_report(
            title="Incendie",
            description="Départ de feu signalé.",
            incident_category="fire_emergency",
            severity="critical",
        )
        item = CitizenRequest.objects.get(pk=response.data["id"])
        dispatch = ReportAlertDispatch.objects.get(request=item)
        # Le test force l'échéance maintenant pour ne pas attendre le backoff.
        dispatch.next_attempt_at = dispatch.created_at
        dispatch.save(update_fields=["next_attempt_at"])

        with patch("apps.city.services.report_alerting.publish_event_now", return_value=True) as retry_publish:
            call_command("retry_report_alerts", limit=10)
        dispatch.refresh_from_db()
        item.refresh_from_db()
        self.assertEqual(dispatch.status, ReportAlertDispatch.Status.DISPATCHED)
        self.assertEqual(item.alert_status, CitizenRequest.AlertStatus.DISPATCHED)
        self.assertGreaterEqual(dispatch.attempts, 2)
        retry_publish.assert_called_once()
        self.assertEqual(
            retry_publish.call_args.kwargs["event_id"],
            str(dispatch.event_id),
        )

    @patch("apps.city.services.report_alerting.publish_event_now", return_value=False)
    def test_failed_alert_is_cancelled_if_citizen_corrects_false_emergency(self, _publish):
        response = self.create_report(
            title="Danger à vérifier",
            description="Signalement initialement classé critique.",
            incident_category="immediate_danger",
            severity="critical",
        )
        item = CitizenRequest.objects.get(pk=response.data["id"])
        dispatch = ReportAlertDispatch.objects.get(request=item)
        self.assertEqual(dispatch.status, ReportAlertDispatch.Status.RETRY)

        self.client.force_authenticate(self.citizen)
        with self.captureOnCommitCallbacks(execute=True):
            corrected = self.client.patch(
                f"/api/citizen/reports/{item.reference}/",
                {
                    "incident_category": "street_lighting",
                    "severity": "moderate",
                    "danger_present": False,
                },
                format="json",
            )
        self.assertEqual(corrected.status_code, 200, corrected.data)
        item.refresh_from_db()
        dispatch.refresh_from_db()
        self.assertEqual(item.handling_route, CitizenRequest.HandlingRoute.STANDARD)
        self.assertEqual(item.alert_status, CitizenRequest.AlertStatus.NONE)
        self.assertEqual(dispatch.status, ReportAlertDispatch.Status.CANCELLED)

    @patch("apps.city.services.report_alerting.publish_event_now", return_value=True)
    def test_agent_acknowledges_alert_and_citizen_is_notified(self, _publish):
        response = self.create_report(
            title="Urgence médicale",
            description="Besoin d'assistance.",
            incident_category="medical_emergency",
            severity="critical",
        )
        item = CitizenRequest.objects.get(pk=response.data["id"])
        self.client.force_authenticate(self.agent)
        with self.captureOnCommitCallbacks(execute=True):
            ack = self.client.post(f"/api/agent/report-alerts/{item.reference}/acknowledge/", {}, format="json")
        self.assertEqual(ack.status_code, 200, ack.data)
        item.refresh_from_db()
        self.assertEqual(item.alert_status, CitizenRequest.AlertStatus.ACKNOWLEDGED)
        self.assertEqual(item.alert_acknowledged_by_id, self.agent.pk)
        self.assertIsNotNone(item.alert_acknowledged_at)
        self.assertIsNotNone(item.acknowledged_at)
        self.assertTrue(
            CitizenNotification.objects.filter(
                user=self.citizen,
                related_request=item,
                title__icontains="pris en charge",
                is_important=True,
            ).exists()
        )

        # Idempotent: un second clic ne crée pas une seconde notification de prise en charge.
        count = CitizenNotification.objects.filter(
            user=self.citizen, related_request=item, title__icontains="pris en charge"
        ).count()
        second = self.client.post(f"/api/agent/report-alerts/{item.reference}/acknowledge/", {}, format="json")
        self.assertEqual(second.status_code, 200, second.data)
        self.assertTrue(second.data["already_acknowledged"])
        self.assertEqual(
            CitizenNotification.objects.filter(
                user=self.citizen, related_request=item, title__icontains="pris en charge"
            ).count(),
            count,
        )

    @patch("apps.city.services.report_alerting.publish_event_now", return_value=True)
    def test_citizen_cannot_access_staff_alert_queue(self, _publish):
        response = self.create_report(
            incident_category="medical_emergency",
            severity="critical",
            title="Urgence médicale",
            description="Situation urgente.",
        )
        item = CitizenRequest.objects.get(pk=response.data["id"])
        self.client.force_authenticate(self.citizen)
        self.assertEqual(self.client.get("/api/agent/report-alerts/").status_code, 403)
        self.assertEqual(
            self.client.post(f"/api/agent/report-alerts/{item.reference}/acknowledge/", {}, format="json").status_code,
            403,
        )

    def test_major_report_is_prioritized_without_emergency_broadcast(self):
        response = self.create_report(
            incident_category="road_damage",
            severity="major",
            title="Chaussée très endommagée",
            description="Le passage est difficile mais sans danger immédiat.",
        )
        self.assertEqual(response.status_code, 201, response.data)
        item = CitizenRequest.objects.get(pk=response.data["id"])
        self.assertEqual(item.handling_route, CitizenRequest.HandlingRoute.PRIORITY)
        self.assertEqual(item.priority, CitizenRequest.Priority.HIGH)
        self.assertEqual(item.alert_status, CitizenRequest.AlertStatus.NONE)
        self.assertFalse(ReportAlertDispatch.objects.filter(request=item).exists())

    def test_categories_expose_which_types_enter_alerting(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.get("/api/citizen/reports/categories/")
        self.assertEqual(response.status_code, 200, response.data)
        categories = {row["code"]: row for row in response.data["categories"]}
        self.assertFalse(categories["street_lighting"]["emergency"])
        self.assertTrue(categories["medical_emergency"]["emergency"])
        self.assertEqual(categories["medical_emergency"]["alerting"], "emergency")
        self.assertIn("services d’urgence", response.data["danger_guidance"])
