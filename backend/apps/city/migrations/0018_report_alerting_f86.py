import uuid

from django.conf import settings
from django.db import migrations, models
from django.db.models import Q
import django.db.models.deletion
import django.utils.timezone




def backfill_report_routes(apps, schema_editor):
    CitizenRequest = apps.get_model("city", "CitizenRequest")
    emergency = CitizenRequest.objects.filter(request_type="report").filter(
        Q(severity="critical")
        | Q(danger_present=True)
        | Q(incident_category__in=["medical_emergency", "fire_emergency", "immediate_danger"])
    )
    emergency.update(handling_route="emergency", priority="urgent")
    CitizenRequest.objects.filter(
        request_type="report", severity="major"
    ).exclude(
        danger_present=True
    ).exclude(
        incident_category__in=["medical_emergency", "fire_emergency", "immediate_danger"]
    ).update(handling_route="priority", priority="high")


class Migration(migrations.Migration):
    dependencies = [
        ("city", "0017_contactmessage_privacy_category"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="citizenrequest",
            name="handling_route",
            field=models.CharField(
                choices=[
                    ("standard", "Circuit standard"),
                    ("priority", "Circuit prioritaire"),
                    ("emergency", "Circuit d’urgence"),
                ],
                db_index=True,
                default="standard",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="citizenrequest",
            name="alert_status",
            field=models.CharField(
                choices=[
                    ("none", "Aucune alerte"),
                    ("pending", "Diffusion en attente"),
                    ("dispatched", "Diffusée"),
                    ("acknowledged", "Prise en charge"),
                ],
                db_index=True,
                default="none",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="citizenrequest",
            name="alert_triggered_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="citizenrequest",
            name="alert_acknowledged_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="citizenrequest",
            name="alert_acknowledged_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="acknowledged_report_alerts",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(backfill_report_routes, migrations.RunPython.noop),
        migrations.AddIndex(
            model_name="citizenrequest",
            index=models.Index(
                fields=["handling_route", "alert_status", "created_at"],
                name="city_req_alert_route_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="citizenrequest",
            index=models.Index(
                fields=["request_type", "priority", "status"],
                name="city_req_priority_idx",
            ),
        ),
        migrations.CreateModel(
            name="ReportAlertDispatch",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_id", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("status", models.CharField(choices=[("pending", "En attente"), ("retry", "À retenter"), ("dispatched", "Diffusée"), ("cancelled", "Annulée")], db_index=True, default="pending", max_length=16)),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("next_attempt_at", models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ("last_error", models.TextField(blank=True)),
                ("dispatched_at", models.DateTimeField(blank=True, null=True)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("request", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="alert_dispatch", to="city.citizenrequest")),
            ],
            options={
                "verbose_name": "diffusion d'alerte signalement",
                "verbose_name_plural": "diffusions d'alertes signalement",
                "ordering": ("next_attempt_at", "id"),
            },
        ),
        migrations.AddIndex(
            model_name="reportalertdispatch",
            index=models.Index(fields=["status", "next_attempt_at"], name="report_alert_retry_idx"),
        ),
    ]
