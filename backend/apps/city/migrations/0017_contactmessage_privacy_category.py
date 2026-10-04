from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("city", "0016_servicefeedback_usage_source_constraint"),
    ]

    operations = [
        migrations.AddField(
            model_name="contactmessage",
            name="category",
            field=models.CharField(
                choices=[
                    ("general", "Contact général"),
                    ("privacy", "Confidentialité / données personnelles"),
                ],
                db_index=True,
                default="general",
                max_length=20,
            ),
        ),
    ]
