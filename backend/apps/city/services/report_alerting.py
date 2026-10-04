from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.realtime.services import publish_event_now, staff_group

from ..models import CitizenRequest, ReportAlertDispatch


EMERGENCY_CATEGORY_CODES = {
    "medical_emergency",
    "fire_emergency",
    "immediate_danger",
}


PRIORITY_CATEGORY_CODES = {
    "transport_disruption",
    "power_outage",
}


def classify_report(*, incident_category="", severity="moderate", danger_present=False):
    """Return (handling_route, priority) for a citizen report.

    Categories explicitly representing an emergency, an immediate danger flag,
    or a critical severity enter the F86 emergency circuit. Major incidents are
    prioritized without being presented as emergency alerts.
    """
    category = str(incident_category or "").strip().lower()
    severity = str(severity or "moderate").strip().lower()
    if category in EMERGENCY_CATEGORY_CODES or bool(danger_present) or severity == "critical":
        return CitizenRequest.HandlingRoute.EMERGENCY, CitizenRequest.Priority.URGENT
    if category in PRIORITY_CATEGORY_CODES or severity == "major":
        return CitizenRequest.HandlingRoute.PRIORITY, CitizenRequest.Priority.HIGH
    return CitizenRequest.HandlingRoute.STANDARD, CitizenRequest.Priority.NORMAL


def build_report_alert_payload(report: CitizenRequest) -> dict:
    """Small staff-only realtime payload; full details stay behind authenticated HTTP."""
    return {
        "reference": report.reference,
        "handling_route": report.handling_route,
        "alert_status": report.alert_status,
        "priority": report.priority,
        "severity": report.severity,
        "incident_category": report.incident_category,
        "title": report.title,
        "district": report.district,
        "location_text": report.location_text,
        "service_id": report.service_id,
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "alert_triggered_at": report.alert_triggered_at.isoformat() if report.alert_triggered_at else None,
        "action_url": f"/agent/requests/{report.reference}",
    }


def ensure_report_alert_dispatch(report: CitizenRequest):
    """Create exactly one durable outbox row for an emergency report."""
    if report.request_type != CitizenRequest.RequestType.REPORT:
        return None
    if (
        report.handling_route != CitizenRequest.HandlingRoute.EMERGENCY
        or report.alert_status not in {
            CitizenRequest.AlertStatus.PENDING,
            CitizenRequest.AlertStatus.DISPATCHED,
        }
    ):
        # Une correction citoyenne peut retirer une fausse urgence tant qu'elle
        # n'a pas été diffusée. L'outbox doit alors être neutralisée afin
        # qu'un retry différé ne republie jamais une alerte devenue obsolète.
        ReportAlertDispatch.objects.filter(request=report).filter(
            status__in=[ReportAlertDispatch.Status.PENDING, ReportAlertDispatch.Status.RETRY]
        ).update(
            status=ReportAlertDispatch.Status.CANCELLED,
            last_error="Alerte annulée avant diffusion : le signalement n'est plus classé emergency.",
            updated_at=timezone.now(),
        )
        return None

    dispatch, created = ReportAlertDispatch.objects.get_or_create(
        request=report,
        defaults={
            "payload": build_report_alert_payload(report),
            "next_attempt_at": timezone.now(),
        },
    )
    if not created and dispatch.status != ReportAlertDispatch.Status.DISPATCHED:
        dispatch.payload = build_report_alert_payload(report)
        dispatch.next_attempt_at = min(dispatch.next_attempt_at, timezone.now())
        dispatch.save(update_fields=["payload", "next_attempt_at", "updated_at"])

    if dispatch.status != ReportAlertDispatch.Status.DISPATCHED:
        transaction.on_commit(lambda pk=dispatch.pk: dispatch_report_alert(pk), robust=True)
    return dispatch


def dispatch_report_alert(dispatch_id: int) -> bool:
    """Try immediate delivery, retaining failed alerts for retry.

    Redis/WebSocket is never the source of truth: failure only updates the
    durable outbox. A retry command can redeliver using the same ``event_id``.
    """
    with transaction.atomic():
        try:
            dispatch = (
                ReportAlertDispatch.objects.select_for_update()
                .select_related("request")
                .get(pk=dispatch_id)
            )
        except ReportAlertDispatch.DoesNotExist:
            return False

        if dispatch.status in {ReportAlertDispatch.Status.DISPATCHED, ReportAlertDispatch.Status.CANCELLED}:
            return True
        report = dispatch.request
        if report.alert_status == CitizenRequest.AlertStatus.ACKNOWLEDGED:
            dispatch.status = ReportAlertDispatch.Status.DISPATCHED
            dispatch.dispatched_at = dispatch.dispatched_at or timezone.now()
            dispatch.last_error = ""
            dispatch.save(update_fields=["status", "dispatched_at", "last_error", "updated_at"])
            return True

        dispatch.attempts += 1
        dispatch.payload = build_report_alert_payload(report)
        event_id = str(dispatch.event_id)
        payload = dict(dispatch.payload)

        delivered = publish_event_now(
            groups=[staff_group()],
            event="staff.report_alert.created",
            event_id=event_id,
            payload=payload,
        )
        now = timezone.now()
        if delivered:
            dispatch.status = ReportAlertDispatch.Status.DISPATCHED
            dispatch.dispatched_at = now
            dispatch.last_error = ""
            dispatch.next_attempt_at = now
            dispatch.save(update_fields=[
                "status", "attempts", "payload", "dispatched_at",
                "last_error", "next_attempt_at", "updated_at",
            ])
            CitizenRequest.objects.filter(
                pk=report.pk,
                alert_status=CitizenRequest.AlertStatus.PENDING,
            ).update(alert_status=CitizenRequest.AlertStatus.DISPATCHED)
            return True

        delay_seconds = min(300, 5 * (2 ** min(dispatch.attempts - 1, 6)))
        dispatch.status = ReportAlertDispatch.Status.RETRY
        dispatch.last_error = "Canal temps réel indisponible ; nouvelle tentative planifiée."
        dispatch.next_attempt_at = now + timedelta(seconds=delay_seconds)
        dispatch.save(update_fields=[
            "status", "attempts", "payload", "last_error", "next_attempt_at", "updated_at",
        ])
        return False


def acknowledge_report_alert(report: CitizenRequest, actor) -> CitizenRequest:
    """Persist staff acknowledgement before broadcasting anything."""
    if report.handling_route != CitizenRequest.HandlingRoute.EMERGENCY:
        raise ValueError("Ce signalement n'appartient pas au circuit d'urgence.")

    now = timezone.now()
    report.alert_status = CitizenRequest.AlertStatus.ACKNOWLEDGED
    report.alert_acknowledged_at = now
    report.alert_acknowledged_by = actor
    if report.acknowledged_at is None:
        report.acknowledged_at = now
    report.save(update_fields=[
        "alert_status", "alert_acknowledged_at", "alert_acknowledged_by",
        "acknowledged_at", "updated_at",
    ])
    ReportAlertDispatch.objects.filter(request=report).exclude(
        status=ReportAlertDispatch.Status.DISPATCHED
    ).update(
        status=ReportAlertDispatch.Status.DISPATCHED,
        dispatched_at=now,
        last_error="",
        next_attempt_at=now,
    )
    return report
