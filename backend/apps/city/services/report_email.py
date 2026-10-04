from __future__ import annotations

from django.conf import settings

from apps.users.models import User

from ..models import CitizenNotification, CitizenRequest
from .notifications import schedule_notification_email


def _category_label(code: str) -> str:
    # Import local pour éviter une dépendance circulaire au chargement des apps.
    from .reports import CATEGORIES

    definition = next((row for row in CATEGORIES if row["code"] == code), None)
    return definition["label"] if definition else (code or "Autre signalement")


def report_should_email_staff(report: CitizenRequest) -> bool:
    if report.request_type != CitizenRequest.RequestType.REPORT:
        return False
    if getattr(settings, "REPORT_EMAIL_FALLBACK_ALL_REPORTS", True):
        return True
    return report.handling_route in {
        CitizenRequest.HandlingRoute.PRIORITY,
        CitizenRequest.HandlingRoute.EMERGENCY,
    }


def notify_staff_new_report(report: CitizenRequest) -> int:
    """Duplique la notification opérationnelle d'un signalement vers l'email.

    La notification en base est la source de vérité. L'email est un fallback de
    diffusion lorsque WebSocket/ASGI n'est pas disponible sur l'hébergement.
    Un échec SMTP ne remet donc jamais en cause la création du signalement et
    peut être repris par le dispatcher d'emails existant.
    """
    if not report_should_email_staff(report):
        return 0

    recipients = User.objects.filter(
        role__in=[User.Role.AGENT, User.Role.ADMIN],
        is_active=True,
        email__gt="",
    ).only("id", "email")

    if report.handling_route == CitizenRequest.HandlingRoute.EMERGENCY:
        prefix = "🚨 Signalement urgent"
    elif report.handling_route == CitizenRequest.HandlingRoute.PRIORITY:
        prefix = "⚠️ Signalement prioritaire"
    else:
        prefix = "Nouveau signalement"

    category = _category_label(report.incident_category)
    place = report.district or report.location_text or "Localisation non précisée"
    message = (
        f"{category} — {report.title}. "
        f"Gravité : {report.get_severity_display()}. "
        f"Lieu : {place}."
    )
    code = f"report:new:{report.pk}"
    created = 0

    for recipient in recipients:
        notice, was_created = CitizenNotification.objects.get_or_create(
            user=recipient,
            related_request=report,
            notification_code=code,
            defaults={
                "scope": CitizenNotification.Scope.TARGETED,
                "kind": CitizenNotification.Kind.REQUEST,
                "title": f"{prefix} {report.reference}"[:220],
                "message": message,
                "action_label": "Ouvrir le signalement",
                "action_url": f"/agent/requests/{report.reference}",
                "is_important": True,
            },
        )
        if not was_created:
            continue
        created += 1
        if getattr(settings, "REPORT_EMAIL_FALLBACK_ENABLED", False):
            schedule_notification_email(notice)

    return created
