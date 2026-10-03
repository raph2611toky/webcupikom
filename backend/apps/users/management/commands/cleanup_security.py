from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.users.models import SecurityOTP, SecurityRateBucket, AccountSession, SecurityEvent


class Command(BaseCommand):
    help = 'Purge les challenges expirés et les anciens compteurs et historiques de sécurité.'

    def handle(self, *args, **options):
        now = timezone.now()
        SecurityOTP.objects.filter(expires_at__lt=now-timedelta(days=1)).delete()
        SecurityRateBucket.objects.filter(started_at__lt=now-timedelta(days=1)).delete()
        AccountSession.objects.filter(expires_at__lt=now-timedelta(days=90)).delete()
        SecurityEvent.objects.filter(created_at__lt=now-timedelta(days=180)).delete()
        self.stdout.write(self.style.SUCCESS('Nettoyage sécurité terminé.'))
