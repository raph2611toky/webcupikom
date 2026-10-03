from django.db import migrations
from django.utils import timezone


def preserve_existing(apps, schema_editor):
    News = apps.get_model('city', 'NewsArticle')
    Notification = apps.get_model('city', 'CitizenNotification')
    now = timezone.now()
    for article in News.objects.all().iterator():
        seen = set()
        for notice in Notification.objects.filter(notification_code=f'news:{article.pk}').order_by('pk').iterator():
            if notice.user_id not in seen:
                Notification.objects.filter(pk=notice.pk).update(related_news_id=article.pk)
                seen.add(notice.user_id)
        if article.is_published and article.published_at <= now:
            News.objects.filter(pk=article.pk).update(delivery_started_at=now, delivery_completed_at=now)


class Migration(migrations.Migration):
    dependencies = [('city', '0008_citizennotification_related_news_and_more')]
    operations = [migrations.RunPython(preserve_existing, migrations.RunPython.noop)]
