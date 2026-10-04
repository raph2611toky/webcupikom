from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("city", "0018_report_alerting_f86"),
    ]

    operations = [
        migrations.AlterField(
            model_name="citizenrequestevent",
            name="event_type",
            field=models.CharField(
                choices=[
                    ("created", "Création"),
                    ("status", "Changement de statut"),
                    ("note", "Étape / note"),
                    ("reply", "Réponse agent → citoyen"),
                ],
                default="note",
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name="citizenrequestevent",
            index=models.Index(
                fields=["request", "event_type", "created_at"],
                name="city_req_event_reply_idx",
            ),
        ),
    ]
