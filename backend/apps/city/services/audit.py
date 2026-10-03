from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from django.db.models import Model

from ..models import StaffAuditEvent


def _json_value(value):
    if isinstance(value, Model):
        return value.pk
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (Decimal, UUID)):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_value(item) for item in value]
    return value


def _client_ip(request):
    if request is None:
        return None
    forwarded = (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
    return forwarded or request.META.get("REMOTE_ADDR") or None


def record_staff_audit(
    *,
    actor,
    action,
    resource_type,
    resource_id="",
    resource_reference="",
    summary,
    changes=None,
    metadata=None,
    subject_user=None,
    request=None,
    visibility=StaffAuditEvent.Visibility.STAFF,
):
    """Create a compact, non-secret audit trace for staff-facing actions.

    Call this inside the same database transaction as the business mutation so
    a failed update cannot leave a misleading audit entry behind.
    """

    return StaffAuditEvent.objects.create(
        actor=actor if getattr(actor, "pk", None) else None,
        actor_role=getattr(actor, "role", "") or "",
        action=str(action)[:80],
        resource_type=str(resource_type)[:40],
        resource_id=str(resource_id or "")[:80],
        resource_reference=str(resource_reference or "")[:120],
        subject_user=subject_user if getattr(subject_user, "pk", None) else None,
        summary=str(summary)[:300],
        changes=_json_value(changes or {}),
        metadata=_json_value(metadata or {}),
        visibility=visibility,
        ip_address=_client_ip(request),
    )
