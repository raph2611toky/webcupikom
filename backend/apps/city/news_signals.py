from django.db import transaction
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import NewsArticle, NewsDistrict
from .services.news import deliver_news


@receiver(post_save, sender=NewsArticle)
def publication_saved(sender, instance, update_fields=None, **kwargs):
    if update_fields and set(update_fields) <= {'delivery_cursor', 'delivery_started_at', 'delivery_completed_at'}:
        return
    if not update_fields or 'target_districts' in update_fields:
        instance.district_targets.all().delete()
        NewsDistrict.objects.bulk_create([NewsDistrict(article=instance, district=d.strip().casefold()) for d in dict.fromkeys(instance.target_districts)])
    # Refresh content for existing notices; no duplicate email for an editorial edit.
    instance.notifications.update(title=instance.title, message=instance.excerpt or instance.instructions[:1000] or 'Nouvelle publication municipale disponible.', is_important=instance.is_important or instance.publication_type == 'alert')
    transaction.on_commit(lambda: deliver_news(instance.pk), robust=True)


@receiver(post_delete, sender=NewsArticle)
def publication_deleted(sender, instance, **kwargs):
    if instance.cover_image:
        storage, name = instance.cover_image.storage, instance.cover_image.name
        transaction.on_commit(lambda: storage.delete(name), robust=True)
