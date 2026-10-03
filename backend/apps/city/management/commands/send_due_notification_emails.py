from django.core.management.base import BaseCommand

from backend.apps.city.services.notifications import dispatch_due_notification_emails


class Command(BaseCommand):
    help = "Envoie les emails des notifications importantes arrivées à échéance."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=500,
            help="Nombre maximum de notifications à traiter par exécution (défaut: 500).",
        )

    def handle(self, *args, **options):
        result = dispatch_due_notification_emails(limit=max(1, options["limit"]))
        self.stdout.write(
            self.style.SUCCESS(
                "Notifications email: "
                f"{result['sent']} envoyée(s), "
                f"{result['failed_or_skipped']} échouée(s)/ignorée(s), "
                f"{result['processed']} traitée(s)."
            )
        )
