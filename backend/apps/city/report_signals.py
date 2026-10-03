from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver
from .models import CitizenRequestAttachment


@receiver(post_delete, sender=CitizenRequestAttachment)
def remove_private_image(sender, instance, **kwargs):
    if instance.image.name:
        storage, name = instance.image.storage, instance.image.name
        transaction.on_commit(lambda: storage.delete(name), robust=True)
