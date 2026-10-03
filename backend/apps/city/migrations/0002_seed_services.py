from django.db import migrations


SERVICES = [
    {
        "name": "Administration",
        "slug": "administration",
        "category": "Administration",
        "short_description": "Démarches administratives et accompagnement des habitants.",
        "sort_order": 10,
    },
    {
        "name": "Transport",
        "slug": "transport",
        "category": "Transport",
        "short_description": "Mobilité, déplacements et informations de transport à Nova Terra.",
        "sort_order": 20,
    },
    {
        "name": "Santé",
        "slug": "sante",
        "category": "Santé",
        "short_description": "Informations et orientation vers les services municipaux de santé.",
        "sort_order": 30,
    },
    {
        "name": "Habitat",
        "slug": "habitat",
        "category": "Habitat",
        "short_description": "Logement, résidence et démarches liées à l'habitat.",
        "sort_order": 40,
    },
    {
        "name": "Énergie",
        "slug": "energie",
        "category": "Énergie",
        "short_description": "Informations et signalements liés aux services énergétiques.",
        "sort_order": 50,
    },
    {
        "name": "Sécurité",
        "slug": "securite",
        "category": "Sécurité",
        "short_description": "Informations municipales et orientation en matière de sécurité.",
        "sort_order": 60,
    },
]


def seed_services(apps, schema_editor):
    MunicipalService = apps.get_model("city", "MunicipalService")
    for item in SERVICES:
        MunicipalService.objects.get_or_create(slug=item["slug"], defaults=item)


class Migration(migrations.Migration):
    dependencies = [
        ("city", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_services, migrations.RunPython.noop),
    ]
