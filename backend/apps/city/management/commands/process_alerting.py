from django.core.management.base import BaseCommand

from apps.city.services.news import dispatch_news
from apps.city.services.notifications import dispatch_due_notification_emails


class Command(BaseCommand):
    help = (
        "Traite en une commande les publications/alertes arrivées à échéance "
        "puis les emails importants encore en attente. À exécuter chaque minute."
    )

    def add_arguments(self, parser):
        parser.add_argument("--publication-limit", type=int, default=100)
        parser.add_argument("--batch-size", type=int, default=500)
        parser.add_argument("--email-limit", type=int, default=500)

    def handle(self, *args, **options):
        delivered = dispatch_news(
            limit=min(max(options["publication_limit"], 1), 1000),
            batch_size=min(max(options["batch_size"], 1), 2000),
        )
        emails = dispatch_due_notification_emails(
            limit=min(max(options["email_limit"], 1), 5000)
        )
        self.stdout.write(
            self.style.SUCCESS(
                "Alerting traité : "
                f"{delivered} notification(s) publication créée(s), "
                f"{emails['sent']} email(s) envoyé(s), "
                f"{emails['failed_or_skipped']} échoué(s)/ignoré(s)."
            )
        )
