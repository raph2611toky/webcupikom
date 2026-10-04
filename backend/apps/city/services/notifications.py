import logging
from urllib.parse import urljoin

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from helpers.services.emails import send_templated_email

from ..models import CitizenNotification
from .news import visible_notifications

logger = logging.getLogger(__name__)


def _absolute_frontend_url(action_url):
    action_url = (action_url or "").strip()
    if not action_url:
        return ""
    if action_url.startswith(("http://", "https://")):
        return action_url
    base = f"{settings.FRONTEND_URL.rstrip('/')}/"
    return urljoin(base, action_url.lstrip("/"))


def notification_email_eligibility_q():
    """Notifications that must also be duplicated by email."""
    return (
        Q(is_important=True)
        | Q(related_news__publication_type__in=['announcement', 'alert'])
        | Q(related_news__is_important=True)
    )


def notification_requires_email(notification):
    article = getattr(notification, 'related_news', None)
    return bool(
        notification.is_important
        or (article and (article.is_important or article.publication_type in {'announcement', 'alert'}))
    )


def notification_email_is_due(notification, *, now=None):
    now = now or timezone.now()
    return bool(
        notification_requires_email(notification)
        and notification.email_sent_at is None
        and notification.visible_from <= now
        and notification.user_id
        and notification.user.email
        and notification.user.is_active
        and CitizenNotification.objects.filter(pk=notification.pk).filter(visible_notifications(now)).exists()
    )


def send_notification_email(notification_id, *, fail_silently=True):
    """Send one due important notification email and persist delivery state.

    A row lock prevents the scheduled dispatcher and an immediate post-commit
    delivery from sending the same notification at the same time.
    """
    try:
        with transaction.atomic():
            notification = (
                CitizenNotification.objects.select_for_update()
                .select_related("user", "sender", "related_news")
                .get(pk=notification_id)
            )
            if not notification_email_is_due(notification):
                return False

            recipient = notification.user
            sender_name = None
            if notification.sender:
                sender_name = (
                    notification.sender.get_full_name().strip()
                    or notification.sender.email
                )

            try:
                send_templated_email(
                    to=recipient.email,
                    subject=f"{notification.title} — {settings.SITE_NAME}",
                    template_name="important_notification",
                    context={
                        "display_name": recipient.get_full_name().strip() or recipient.email,
                        "notification_title": notification.title,
                        "notification_message": notification.message,
                        "notification_kind": notification.get_kind_display(),
                        "sender_name": sender_name,
                        "action_label": notification.action_label,
                        "action_url": _absolute_frontend_url(notification.action_url),
                        "visible_from": notification.visible_from,
                    },
                )
            except Exception as exc:
                notification.email_last_error = str(exc)[:4000]
                notification.save(update_fields=["email_last_error"])
                logger.exception(
                    "Unable to send important notification email %s",
                    notification.pk,
                )
                if not fail_silently:
                    raise
                return False

            notification.email_sent_at = timezone.now()
            notification.email_last_error = ""
            notification.save(update_fields=["email_sent_at", "email_last_error"])
            return True
    except CitizenNotification.DoesNotExist:
        return False


def dispatch_due_notification_emails(*, notification_code=None, limit=500):
    queryset = CitizenNotification.objects.filter(
        email_sent_at__isnull=True,
        visible_from__lte=timezone.now(),
        user__email__gt="",
    ).filter(notification_email_eligibility_q()).filter(visible_notifications(), user__is_active=True).order_by("visible_from", "id")
    if notification_code:
        queryset = queryset.filter(notification_code=notification_code)

    notification_ids = list(queryset.values_list("id", flat=True)[:limit])
    sent = 0
    failed_or_skipped = 0
    for notification_id in notification_ids:
        if send_notification_email(notification_id, fail_silently=True):
            sent += 1
        else:
            failed_or_skipped += 1
    return {
        "processed": len(notification_ids),
        "sent": sent,
        "failed_or_skipped": failed_or_skipped,
    }


def schedule_notification_email(notification):
    """Send immediately after commit when due; future emails stay pending."""
    if not notification_requires_email(notification):
        return
    notification_id = notification.pk
    transaction.on_commit(lambda: send_notification_email(notification_id, fail_silently=True))


def schedule_notification_batch(notification_code):
    """Dispatch a due global/manual batch after the surrounding transaction commits."""
    transaction.on_commit(
        lambda: dispatch_due_notification_emails(notification_code=notification_code)
    )
