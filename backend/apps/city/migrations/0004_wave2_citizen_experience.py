import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


SERVICE_UPDATES = {
    "administration": {
        "actions": [
            "Demander un document administratif",
            "Mettre à jour une information citoyenne",
        ],
        "is_featured": True,
        "priority_order": 10,
        "translations": {
            "en": {
                "name": "Administration",
                "category": "Administration",
                "short_description": "Administrative procedures and support for residents.",
                "actions": [
                    "Request an administrative document",
                    "Update citizen information",
                ],
            }
        },
    },
    "transport": {
        "actions": ["Consulter les informations de mobilité", "Signaler un problème de transport"],
        "is_featured": True,
        "priority_order": 20,
        "translations": {
            "en": {
                "name": "Transport",
                "category": "Transport",
                "short_description": "Mobility, travel and transport information in Nova Terra.",
                "actions": ["View mobility information", "Report a transport issue"],
            }
        },
    },
    "sante": {
        "actions": ["Trouver un service de santé", "Demander une orientation"],
        "is_featured": True,
        "priority_order": 30,
        "translations": {
            "en": {
                "name": "Health",
                "category": "Health",
                "short_description": "Information and guidance to Nova Terra municipal health services.",
                "actions": ["Find a health service", "Request guidance"],
            }
        },
    },
    "habitat": {
        "actions": ["Consulter les démarches liées au logement", "Signaler un problème d'habitat"],
        "is_featured": False,
        "priority_order": 40,
        "translations": {
            "en": {
                "name": "Housing",
                "category": "Housing",
                "short_description": "Housing, residence and related municipal procedures.",
                "actions": ["View housing procedures", "Report a housing issue"],
            }
        },
    },
    "energie": {
        "actions": ["Consulter les informations énergie", "Signaler un incident énergétique"],
        "is_featured": False,
        "priority_order": 50,
        "translations": {
            "en": {
                "name": "Energy",
                "category": "Energy",
                "short_description": "Information and reports related to municipal energy services.",
                "actions": ["View energy information", "Report an energy incident"],
            }
        },
    },
    "securite": {
        "actions": ["Consulter les informations de sécurité", "Contacter le service compétent"],
        "is_featured": False,
        "priority_order": 60,
        "translations": {
            "en": {
                "name": "Safety",
                "category": "Safety",
                "short_description": "Municipal information and guidance related to safety.",
                "actions": ["View safety information", "Contact the appropriate service"],
            }
        },
    },
}


def seed_wave2_services(apps, schema_editor):
    MunicipalService = apps.get_model("city", "MunicipalService")
    for slug, values in SERVICE_UPDATES.items():
        MunicipalService.objects.filter(slug=slug).update(**values)


def seed_existing_request_timeline(apps, schema_editor):
    CitizenRequest = apps.get_model("city", "CitizenRequest")
    CitizenRequestEvent = apps.get_model("city", "CitizenRequestEvent")
    events = []
    for item in CitizenRequest.objects.all().iterator():
        events.append(
            CitizenRequestEvent(
                request_id=item.pk,
                actor_id=item.citizen_id,
                event_type="created",
                status=item.status,
                title="Demande enregistrée",
                message="Historique initialisé pour cette demande.",
                is_public=True,
            )
        )
    if events:
        CitizenRequestEvent.objects.bulk_create(events, batch_size=500)


class Migration(migrations.Migration):
    dependencies = [
        ("city", "0003_contact_assignment_notifications"),
    ]

    operations = [
        migrations.AddField(
            model_name="municipalservice",
            name="actions",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="municipalservice",
            name="faq",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="municipalservice",
            name="is_featured",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="municipalservice",
            name="priority_order",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="municipalservice",
            name="required_documents",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="municipalservice",
            name="translations",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="municipalservice",
            name="usage_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="citizenrequest",
            name="incident_category",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="citizenrequest",
            name="latitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="citizenrequest",
            name="location_text",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="citizenrequest",
            name="longitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="citizenrequest",
            name="request_type",
            field=models.CharField(
                choices=[("procedure", "Démarche"), ("report", "Signalement")],
                default="procedure",
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="CitizenPreference",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("screen_reader_mode", models.BooleanField(default=False)),
                ("high_contrast", models.BooleanField(default=False)),
                ("font_scale", models.PositiveSmallIntegerField(default=100)),
                ("onboarding_step", models.CharField(default="welcome", max_length=32)),
                ("onboarding_completed_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="city_preference",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "préférence citoyenne",
                "verbose_name_plural": "préférences citoyennes",
            },
        ),
        migrations.CreateModel(
            name="CitizenRequestEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "event_type",
                    models.CharField(
                        choices=[
                            ("created", "Création"),
                            ("status", "Changement de statut"),
                            ("note", "Étape / note"),
                        ],
                        default="note",
                        max_length=20,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("submitted", "Envoyée"),
                            ("pending", "À traiter"),
                            ("in_progress", "En traitement"),
                            ("action_required", "Action requise"),
                            ("completed", "Terminée"),
                        ],
                        max_length=24,
                    ),
                ),
                ("title", models.CharField(max_length=220)),
                ("message", models.TextField(blank=True)),
                ("is_public", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="citizen_request_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "request",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="timeline_events",
                        to="city.citizenrequest",
                    ),
                ),
            ],
            options={
                "verbose_name": "étape de demande citoyenne",
                "verbose_name_plural": "étapes de demandes citoyennes",
                "ordering": ("created_at", "id"),
            },
        ),
        migrations.RunPython(seed_wave2_services, migrations.RunPython.noop),
        migrations.RunPython(seed_existing_request_timeline, migrations.RunPython.noop),
    ]
