from __future__ import annotations

from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone

from apps.city.models import (
    CitizenAppointment,
    CitizenNotification,
    CitizenRequest,
    CitizenRequestEvent,
    ContactMessage,
    MunicipalService,
    NewsArticle,
    StaffAuditEvent,
    WebCupSyncState,
)
from apps.users.models import User

from .services import (
    publish_after_commit,
    resource_group,
    role_group,
    staff_group,
    user_group,
)




@receiver(pre_save, sender=User)
def user_before_save(sender, instance, **kwargs):
    if not instance.pk:
        instance._realtime_previous_security = None
        return
    instance._realtime_previous_security = User.objects.filter(pk=instance.pk).values(
        "role", "is_active", "auth_token_version"
    ).first()


@receiver(post_save, sender=User)
def user_security_saved(sender, instance, created, **kwargs):
    if created:
        return
    previous = getattr(instance, "_realtime_previous_security", None) or {}
    role_changed = previous.get("role") not in {None, instance.role}
    disabled = previous.get("is_active") is True and not instance.is_active
    version_changed = (
        previous.get("auth_token_version") is not None
        and previous.get("auth_token_version") != instance.auth_token_version
    )
    if not (role_changed or disabled or version_changed):
        return
    event = "security.account_disabled" if disabled else "security.permissions_changed"
    publish_after_commit(
        groups=[user_group(instance.pk)],
        event=event,
        payload={
            "role_changed": role_changed,
            "account_active": instance.is_active,
            "security_version_changed": version_changed,
            "reauthentication_required": True,
        },
    )


def _user_name(user):
    if not user:
        return None
    return user.get_full_name().strip() or user.email


@receiver(post_save, sender=CitizenNotification)
def notification_saved(sender, instance, created, **kwargs):
    publish_after_commit(
        groups=[user_group(instance.user_id)],
        event="notification.created" if created else "notification.updated",
        payload={
            "id": instance.pk,
            "kind": instance.kind,
            "title": instance.title,
            "message": instance.message,
            "action_label": instance.action_label,
            "action_url": instance.action_url,
            "is_important": instance.is_important,
            "is_read": instance.is_read,
            "visible_from": instance.visible_from,
            "visible_now": instance.visible_from <= timezone.now(),
            "news_slug": instance.related_news.slug if instance.related_news_id else None,
            "news_publication_type": instance.related_news.publication_type if instance.related_news_id else None,
            "news_severity": instance.related_news.severity if instance.related_news_id else None,
            "news_expires_at": instance.related_news.expires_at if instance.related_news_id else None,
            "related_request": instance.related_request.reference if instance.related_request_id else None,
            "related_appointment": instance.related_appointment.reference if instance.related_appointment_id else None,
        },
    )


@receiver(post_delete, sender=CitizenNotification)
def notification_deleted(sender, instance, **kwargs):
    if instance.user_id:
        publish_after_commit(
            groups=[user_group(instance.user_id)],
            event="notification.deleted",
            payload={"id": instance.pk},
        )


@receiver(post_save, sender=CitizenRequest)
def request_saved(sender, instance, created, **kwargs):
    base = {
        "reference": instance.reference,
        "request_type": instance.request_type,
        "status": instance.status,
        "status_label": instance.get_status_display(),
        "updated_at": instance.updated_at,
        "requires_citizen_action": instance.status == CitizenRequest.Status.ACTION_REQUIRED,
    }
    publish_after_commit(
        groups=[user_group(instance.citizen_id), resource_group("request", instance.pk)],
        event="request.created" if created else "request.updated",
        payload=base,
    )
    publish_after_commit(
        groups=[staff_group()],
        event="staff.request.created" if created else "staff.request.updated",
        payload={
            **base,
            "priority": instance.priority,
            "assigned_to_id": instance.assigned_to_id,
            "service_id": instance.service_id,
            "requires_agent_action": instance.status in {
                CitizenRequest.Status.SUBMITTED,
                CitizenRequest.Status.PENDING,
                CitizenRequest.Status.IN_PROGRESS,
            },
        },
    )


@receiver(post_save, sender=CitizenRequestEvent)
def request_event_saved(sender, instance, created, **kwargs):
    if not created:
        return
    payload = {
        "request_reference": instance.request.reference,
        "id": instance.pk,
        "event_type": instance.event_type,
        "status": instance.status,
        "title": instance.title,
        "message": instance.message,
        "is_public": instance.is_public,
        "created_at": instance.created_at,
    }
    # Les notes internes ne sont jamais envoyées au groupe ressource partagé,
    # car ce groupe peut contenir le citoyen propriétaire.
    publish_after_commit(
        groups=[staff_group()],
        event="request.timeline.created",
        payload=payload,
    )
    if instance.is_public:
        publish_after_commit(
            groups=[user_group(instance.request.citizen_id), resource_group("request", instance.request_id)],
            event="request.timeline.created",
            payload=payload,
        )


@receiver(pre_save, sender=CitizenAppointment)
def appointment_before_save(sender, instance, **kwargs):
    if not instance.pk:
        instance._realtime_previous_participants = None
        return
    instance._realtime_previous_participants = CitizenAppointment.objects.filter(
        pk=instance.pk
    ).values("agent_id", "citizen_id").first()


@receiver(post_save, sender=CitizenAppointment)
def appointment_saved(sender, instance, created, **kwargs):
    payload = {
        "reference": instance.reference,
        "status": instance.status,
        "starts_at": instance.starts_at,
        "ends_at": instance.ends_at,
        "location": instance.location,
        "service_id": instance.service_id,
        "updated_at": instance.updated_at,
    }
    groups = [
        user_group(instance.citizen_id),
        user_group(instance.agent_id),
        role_group(User.Role.ADMIN),
        resource_group("appointment", instance.pk),
    ]
    publish_after_commit(
        groups=groups,
        event="appointment.created" if created else "appointment.updated",
        payload=payload,
    )
    previous = getattr(instance, "_realtime_previous_participants", None) or {}
    old_agent_id = previous.get("agent_id")
    old_citizen_id = previous.get("citizen_id")
    if old_agent_id and old_agent_id != instance.agent_id:
        publish_after_commit(
            groups=[user_group(old_agent_id)],
            event="appointment.removed",
            payload={"reference": instance.reference, "reason": "reassigned"},
        )
    if old_citizen_id and old_citizen_id != instance.citizen_id:
        publish_after_commit(
            groups=[user_group(old_citizen_id)],
            event="appointment.removed",
            payload={"reference": instance.reference, "reason": "ownership_changed"},
        )


@receiver(post_save, sender=ContactMessage)
def contact_saved(sender, instance, created, **kwargs):
    staff_payload = {
        "reference": instance.reference,
        "status": instance.status,
        "subject": instance.subject,
        "assigned_to_id": instance.assigned_to_id,
        "updated_at": instance.updated_at,
    }
    publish_after_commit(
        groups=[staff_group()],
        event="contact.created" if created else "contact.updated",
        payload=staff_payload,
    )
    if instance.user_id:
        publish_after_commit(
            groups=[user_group(instance.user_id)],
            event="contact.created" if created else "contact.updated",
            payload={
                "reference": instance.reference,
                "status": instance.status,
                "updated_at": instance.updated_at,
            },
        )
    if instance.assigned_to_id:
        publish_after_commit(
            groups=[user_group(instance.assigned_to_id)],
            event="contact.assigned",
            payload=staff_payload,
        )


@receiver(post_save, sender=StaffAuditEvent)
def audit_saved(sender, instance, created, **kwargs):
    if not created:
        return
    groups = (
        [role_group(User.Role.ADMIN)]
        if instance.visibility == StaffAuditEvent.Visibility.ADMIN
        else [staff_group()]
    )
    publish_after_commit(
        groups=groups,
        event="audit.created",
        payload={
            "id": instance.pk,
            "action": instance.action,
            "resource_type": instance.resource_type,
            "resource_id": instance.resource_id,
            "resource_reference": instance.resource_reference,
            "summary": instance.summary,
            "actor": {
                "id": instance.actor_id,
                "display_name": _user_name(instance.actor),
                "role": instance.actor_role,
            },
            "created_at": instance.created_at,
        },
    )


@receiver(post_save, sender=MunicipalService)
def service_saved(sender, instance, created, **kwargs):
    payload = {
        "slug": instance.slug,
        "name": instance.name,
        "is_active": instance.is_active,
        "updated_at": instance.updated_at,
    }
    publish_after_commit(
        groups=[role_group(User.Role.CITIZEN), staff_group()],
        event="service.created" if created else "service.updated",
        payload=payload,
    )


@receiver(post_delete, sender=MunicipalService)
def service_deleted(sender, instance, **kwargs):
    publish_after_commit(
        groups=[role_group(User.Role.CITIZEN), staff_group()],
        event="service.deleted",
        payload={"slug": instance.slug},
    )


@receiver(post_save, sender=NewsArticle)
def news_saved(sender, instance, created, update_fields=None, **kwargs):
    # Les saves internes du curseur de diffusion ne doivent pas polluer le socket.
    if update_fields and set(update_fields) <= {
        "delivery_cursor", "delivery_started_at", "delivery_completed_at"
    }:
        return
    publish_after_commit(
        groups=[staff_group()],
        event="news.created" if created else "news.updated",
        payload={
            "id": instance.pk,
            "slug": instance.slug,
            "title": instance.title,
            "publication_type": instance.publication_type,
            "severity": instance.severity,
            "is_published": instance.is_published,
            "published_at": instance.published_at,
            "expires_at": instance.expires_at,
        },
    )
    active_for_public = (
        instance.is_published
        and instance.published_at <= timezone.now()
        and (instance.expires_at is None or instance.expires_at > timezone.now())
    )
    if active_for_public:
        # Pas de titre ici : un article ciblé par quartier ne doit pas fuiter son
        # contenu aux autres citoyens. Le détail ciblé arrive via notification.
        publish_after_commit(
            groups=[role_group(User.Role.CITIZEN)],
            event="news.refresh",
            payload={"reason": "publication_changed"},
        )


@receiver(post_delete, sender=NewsArticle)
def news_deleted(sender, instance, **kwargs):
    publish_after_commit(
        groups=[staff_group(), role_group(User.Role.CITIZEN)],
        event="news.refresh",
        payload={"reason": "publication_deleted"},
    )


@receiver(post_save, sender=WebCupSyncState)
def webcup_sync_saved(sender, instance, **kwargs):
    publish_after_commit(
        groups=[staff_group()],
        event="webcup.sync.updated",
        payload={
            "api_version": instance.api_version,
            "session": instance.session,
            "last_success_at": instance.last_success_at,
            "last_error": bool(instance.last_error),
            "updated_at": instance.updated_at,
        },
    )
