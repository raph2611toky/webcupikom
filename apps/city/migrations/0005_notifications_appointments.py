# Generated for Terra Nova notification and appointment features.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("city", "0004_wave2_citizen_experience"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CitizenAppointment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reference", models.CharField(editable=False, max_length=32, unique=True)),
                ("starts_at", models.DateTimeField()),
                ("ends_at", models.DateTimeField()),
                ("reason", models.CharField(max_length=220)),
                ("details", models.TextField(blank=True)),
                ("location", models.CharField(blank=True, max_length=255)),
                ("preparation_instructions", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("requested", "Demandé"), ("confirmed", "Confirmé"), ("declined", "Refusé"), ("cancelled", "Annulé"), ("completed", "Terminé")], default="requested", max_length=20)),
                ("reminder_enabled", models.BooleanField(default=True)),
                ("reminder_minutes_before", models.PositiveIntegerField(default=60)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("agent", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="agent_appointments", to=settings.AUTH_USER_MODEL)),
                ("citizen", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="citizen_appointments", to=settings.AUTH_USER_MODEL)),
                ("service", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="appointments", to="city.municipalservice")),
            ],
            options={
                "verbose_name": "rendez-vous citoyen",
                "verbose_name_plural": "rendez-vous citoyens",
                "ordering": ("starts_at", "id"),
            },
        ),
        migrations.AddIndex(
            model_name="citizenappointment",
            index=models.Index(fields=["agent", "starts_at"], name="city_appt_agent_start_idx"),
        ),
        migrations.AddIndex(
            model_name="citizenappointment",
            index=models.Index(fields=["citizen", "starts_at"], name="city_appt_cit_start_idx"),
        ),
        migrations.AddField(
            model_name="citizennotification",
            name="sender",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sent_city_notifications", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name="citizennotification",
            name="scope",
            field=models.CharField(choices=[("global", "Globale"), ("targeted", "Ciblée"), ("automated", "Automatique")], default="automated", max_length=20),
        ),
        migrations.AlterField(
            model_name="citizennotification",
            name="kind",
            field=models.CharField(choices=[("request", "Demande"), ("contact", "Contact"), ("news", "Actualité"), ("appointment", "Rendez-vous"), ("system", "Système")], default="system", max_length=20),
        ),
        migrations.AddField(
            model_name="citizennotification",
            name="action_label",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="citizennotification",
            name="action_url",
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name="citizennotification",
            name="notification_code",
            field=models.CharField(blank=True, db_index=True, max_length=80),
        ),
        migrations.AddField(
            model_name="citizennotification",
            name="visible_from",
            field=models.DateTimeField(db_index=True, default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name="citizennotification",
            name="related_appointment",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="notifications", to="city.citizenappointment"),
        ),
    ]
