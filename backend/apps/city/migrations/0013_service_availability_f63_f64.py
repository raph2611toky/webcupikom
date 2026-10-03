from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("city", "0012_municipal_projects_participation"),
    ]

    operations = [
        migrations.AddField(
            model_name="municipalservice",
            name="alternative_action",
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name="municipalservice",
            name="availability_updated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="municipalservice",
            name="expected_restore_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="municipalservice",
            name="unavailability_reason",
            field=models.CharField(blank=True, max_length=300),
        ),
        migrations.AddField(
            model_name="municipalservice",
            name="unavailable_since",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
