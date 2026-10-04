from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.city.models import ReportAlertDispatch
from apps.city.services.report_alerting import dispatch_report_alert


class Command(BaseCommand):
    help = "Retente les alertes de signalement F86 dont la diffusion temps réel a échoué."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        limit = max(1, min(int(options["limit"]), 1000))
        ids = list(
            ReportAlertDispatch.objects.filter(
                status__in=[
                    ReportAlertDispatch.Status.PENDING,
                    ReportAlertDispatch.Status.RETRY,
                ],
                next_attempt_at__lte=timezone.now(),
            )
            .order_by("next_attempt_at", "id")
            .values_list("id", flat=True)[:limit]
        )
        delivered = 0
        for dispatch_id in ids:
            if dispatch_report_alert(dispatch_id):
                delivered += 1
        self.stdout.write(
            self.style.SUCCESS(
                f"Alertes vérifiées: {len(ids)} ; diffusées/terminées: {delivered}."
            )
        )
