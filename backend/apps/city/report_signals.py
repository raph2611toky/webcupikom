from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from .models import CitizenRequest, CitizenRequestAttachment


@receiver(post_delete, sender=CitizenRequestAttachment)
def remove_private_image(sender, instance, **kwargs):
    if instance.image.name:
        storage, name = instance.image.storage, instance.image.name
        transaction.on_commit(lambda: storage.delete(name), robust=True)


@receiver(post_save, sender=CitizenRequest)
def ensure_emergency_alert_outbox(sender, instance, created=False, **kwargs):
    # Imports locaux pour garder les signaux légers au démarrage de Django.
    from .services.report_alerting import ensure_report_alert_dispatch
    from .services.report_email import notify_staff_new_report

    ensure_report_alert_dispatch(instance)
    if created and instance.request_type == CitizenRequest.RequestType.REPORT:
        notify_staff_new_report(instance)
