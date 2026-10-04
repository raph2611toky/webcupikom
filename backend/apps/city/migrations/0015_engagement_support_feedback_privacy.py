from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("city", "0014_citylocation_transport_geolocation"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CitizenRequestSupport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("citizen", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="citizen_request_supports", to=settings.AUTH_USER_MODEL)),
                ("request", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="request_supports", to="city.citizenrequest")),
            ],
            options={"ordering": ("-created_at", "-id"), "verbose_name": "soutien à une demande citoyenne", "verbose_name_plural": "soutiens aux demandes citoyennes"},
        ),
        migrations.AddConstraint(
            model_name="citizenrequestsupport",
            constraint=models.UniqueConstraint(fields=("request", "citizen"), name="unique_request_citizen_support"),
        ),
        migrations.AddIndex(
            model_name="citizenrequestsupport",
            index=models.Index(fields=["request", "created_at"], name="city_req_support_idx"),
        ),
        migrations.CreateModel(
            name="ServiceFeedback",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reference", models.CharField(editable=False, max_length=32, unique=True)),
                ("rating", models.PositiveSmallIntegerField()),
                ("comment", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("citizen", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="service_feedbacks", to=settings.AUTH_USER_MODEL)),
                ("service", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="feedbacks", to="city.municipalservice")),
                ("source_appointment", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="service_feedbacks", to="city.citizenappointment")),
                ("source_request", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="service_feedbacks", to="city.citizenrequest")),
            ],
            options={"ordering": ("-created_at", "-id"), "verbose_name": "avis sur un service", "verbose_name_plural": "avis sur les services"},
        ),
        migrations.AddConstraint(
            model_name="servicefeedback",
            constraint=models.UniqueConstraint(fields=("citizen", "service"), name="unique_citizen_service_feedback"),
        ),
        migrations.AddConstraint(
            model_name="servicefeedback",
            constraint=models.CheckConstraint(condition=models.Q(("rating__gte", 1), ("rating__lte", 5)), name="service_feedback_rating_1_5"),
        ),
        migrations.AddIndex(
            model_name="servicefeedback",
            index=models.Index(fields=["service", "created_at"], name="city_feedback_service_idx"),
        ),
        migrations.CreateModel(
            name="PrivacyConcern",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reference", models.CharField(editable=False, max_length=32, unique=True)),
                ("topic", models.CharField(choices=[("data_usage", "Utilisation de mes données"), ("transparency", "Comprendre les données conservées"), ("correction", "Correction d'informations"), ("deletion", "Suppression / conservation"), ("consent", "Consentement et préférences"), ("security", "Sécurité / confidentialité"), ("other", "Autre préoccupation")], default="data_usage", max_length=24)),
                ("subject", models.CharField(max_length=220)),
                ("message", models.TextField()),
                ("status", models.CharField(choices=[("received", "Reçue"), ("in_review", "En analyse"), ("resolved", "Traitée"), ("closed", "Clôturée")], db_index=True, default="received", max_length=20)),
                ("admin_note", models.TextField(blank=True)),
                ("handled_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("citizen", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="privacy_concerns", to=settings.AUTH_USER_MODEL)),
                ("handled_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="handled_privacy_concerns", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("-created_at", "-id"), "verbose_name": "préoccupation vie privée", "verbose_name_plural": "préoccupations vie privée"},
        ),
        migrations.AddIndex(
            model_name="privacyconcern",
            index=models.Index(fields=["status", "created_at"], name="city_privacy_status_idx"),
        ),
        migrations.AddIndex(
            model_name="privacyconcern",
            index=models.Index(fields=["citizen", "created_at"], name="city_privacy_citizen_idx"),
        ),
    ]
