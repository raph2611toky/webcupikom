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


def publication_requires_email(article):
    """Email duplicate for announcements, alerts and explicitly important news."""
    return bool(article.is_important or article.publication_type in {'announcement', 'alert'})


def deliver_news(article_id, limit=500):
    """Diffuse un lot de publication de façon atomique et reprenable.

    Les annonces, alertes et publications importantes tentent aussi un envoi
    email après commit ; la commande périodique reprend les emails futurs ou
    échoués.
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
        # Lire un élément supplémentaire permet de savoir si une autre passe est
        # réellement nécessaire. Avec exactement ``limit`` habitants, l'ancien
        # code laissait la diffusion artificiellement incomplète jusqu'au cron.
        fetched_ids = list(users.order_by('pk').values_list('pk', flat=True)[:limit + 1])
        has_more = len(fetched_ids) > limit
        ids = fetched_ids[:limit]
        notification_code = f'news:{article.pk}'
        important = article.is_important or article.publication_type == 'alert'
        email_required = publication_requires_email(article)
        for user_id in ids:
            CitizenNotification.objects.get_or_create(user_id=user_id, related_news=article, defaults={
                'sender_id': article.author_id, 'scope': 'targeted' if article.target_districts else 'global',
                'kind': CitizenNotification.Kind.NEWS, 'title': article.title,
                'message': article.excerpt or article.instructions[:1000] or 'Nouvelle publication municipale disponible.',
                'action_label': article.action_label or ('Consulter les consignes' if article.publication_type == 'alert' else 'Lire la publication'),
                'action_url': article.action_url or f'/news/{article.slug}', 'notification_code': notification_code,
                'visible_from': article.published_at,
                'is_important': important,
            })
        if ids:
            article.delivery_cursor = ids[-1]
        if not has_more:
            article.delivery_completed_at = timezone.now()
        article.save(update_fields=['delivery_cursor', 'delivery_started_at', 'delivery_completed_at'])

        # Les annonces, alertes et publications importantes doivent déclencher l'email
        # dès que leur lot de notifications est commité. Le worker/cron reste
        # le filet de rattrapage pour les publications futures et les échecs SMTP.
        if ids and email_required:
            def dispatch_email_batch():
                from .notifications import dispatch_due_notification_emails
                dispatch_due_notification_emails(notification_code=notification_code, limit=limit)
            transaction.on_commit(dispatch_email_batch, robust=True)

        return len(ids)


def dispatch_news(limit=100, batch_size=500):
    ids = list(NewsArticle.objects.filter(active_news(), notify_residents=True, delivery_completed_at__isnull=True).order_by('published_at', 'pk').values_list('pk', flat=True)[:limit])
    return sum(deliver_news(pk, batch_size) for pk in ids)
