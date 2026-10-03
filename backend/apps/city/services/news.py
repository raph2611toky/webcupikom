"""Publication windows and resumable, idempotent resident delivery."""
from django.db import transaction
from django.db.models import Q, Case, When, Value, IntegerField
from django.utils import timezone
from apps.users.models import User
from ..models import NewsArticle, CitizenNotification


def active_news(now=None):
    now = now or timezone.now()
    return Q(is_published=True, published_at__lte=now) & (Q(expires_at__isnull=True) | Q(expires_at__gt=now))


def visible_notifications(now=None):
    now = now or timezone.now()
    return Q(related_news__isnull=True) | (Q(related_news__is_published=True, related_news__published_at__lte=now) & (Q(related_news__expires_at__isnull=True) | Q(related_news__expires_at__gt=now)))


def ordered_news(queryset):
    return queryset.annotate(_urgency=Case(When(severity='critical', then=Value(2)), When(severity='warning', then=Value(1)), default=Value(0), output_field=IntegerField())).order_by('-_urgency', '-is_pinned', '-published_at', '-id')


def deliver_news(article_id, limit=500):
    """One bounded transaction per article; cursor and notices commit together.

    No external email is sent here. The existing email worker drains the outbox.
    """
    limit = min(max(int(limit), 1), 2000)
    with transaction.atomic():
        article = NewsArticle.objects.select_for_update().filter(pk=article_id).filter(active_news()).first()
        if not article or not article.notify_residents or article.delivery_completed_at:
            return 0
        if not article.delivery_started_at:
            article.delivery_started_at = timezone.now()
        users = User.objects.filter(role=User.Role.CITIZEN, is_active=True, pk__gt=article.delivery_cursor)
        if article.target_districts:
            areas = Q()
            for district in article.target_districts:
                areas |= Q(district__iexact=district)
            users = users.filter(areas)
        ids = list(users.order_by('pk').values_list('pk', flat=True)[:limit])
        for user_id in ids:
            CitizenNotification.objects.get_or_create(user_id=user_id, related_news=article, defaults={
                'sender_id': article.author_id, 'scope': 'targeted' if article.target_districts else 'global',
                'kind': CitizenNotification.Kind.NEWS, 'title': article.title,
                'message': article.excerpt or article.instructions[:1000] or 'Nouvelle publication municipale disponible.',
                'action_label': 'Consulter les consignes' if article.publication_type == 'alert' else 'Lire la publication',
                'action_url': f'/news/{article.slug}', 'notification_code': f'news:{article.pk}',
                'visible_from': article.published_at,
                'is_important': article.is_important or article.publication_type == 'alert',
            })
        if ids:
            article.delivery_cursor = ids[-1]
        if len(ids) < limit:
            article.delivery_completed_at = timezone.now()
        article.save(update_fields=['delivery_cursor', 'delivery_started_at', 'delivery_completed_at'])
        return len(ids)


def dispatch_news(limit=100, batch_size=500):
    ids = list(NewsArticle.objects.filter(active_news(), notify_residents=True, delivery_completed_at__isnull=True).order_by('published_at', 'pk').values_list('pk', flat=True)[:limit])
    return sum(deliver_news(pk, batch_size) for pk in ids)
