from django.core.management.base import BaseCommand
from apps.city.services.news import dispatch_news


class Command(BaseCommand):
    help = 'Diffuse les publications arrivées à échéance, par lots reprenables.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100)
        parser.add_argument('--batch-size', type=int, default=500)

    def handle(self, *args, **options):
        count = dispatch_news(limit=min(max(options['limit'], 1), 1000), batch_size=options['batch_size'])
        self.stdout.write(f'{count} destinataires traités.')
