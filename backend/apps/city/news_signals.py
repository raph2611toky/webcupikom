from django.db import transaction
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import NewsArticle, NewsDistrict
from .services.news import deliver_news, publication_requires_email


@receiver(post_save, sender=NewsArticle)
def publication_saved(sender, instance, update_fields=None, **kwargs):
    if update_fields and set(update_fields) <= {'delivery_cursor', 'delivery_started_at', 'delivery_completed_at'}:
        return
    if not update_fields or 'target_districts' in update_fields:
        instance.district_targets.all().delete()
        NewsDistrict.objects.bulk_create([NewsDistrict(article=instance, district=d.strip().casefold()) for d in dict.fromkeys(instance.target_districts)])
    # Actualiser les notifications déjà créées sans en dupliquer. Si une
    # publication devient importante après sa première diffusion, les emails
    # encore non envoyés seront pris en charge immédiatement puis par le cron.
    important = instance.is_important or instance.publication_type == 'alert'
    email_required = publication_requires_email(instance)
    instance.notifications.update(
        title=instance.title,
        message=instance.excerpt or instance.instructions[:1000] or 'Nouvelle publication municipale disponible.',
        action_label=instance.action_label or ('Consulter les consignes' if instance.publication_type == 'alert' else 'Lire la publication'),
        action_url=instance.action_url or f'/news/{instance.slug}',
        is_important=important,
    )
    transaction.on_commit(lambda: deliver_news(instance.pk), robust=True)
    if email_required:
        from .services.notifications import schedule_notification_batch
        schedule_notification_batch(f'news:{instance.pk}')


@receiver(post_delete, sender=NewsArticle)
def publication_deleted(sender, instance, **kwargs):
    if instance.cover_image:
        storage, name = instance.cover_image.storage, instance.cover_image.name
        transaction.on_commit(lambda: storage.delete(name), robust=True)
