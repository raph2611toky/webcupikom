from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("city", "0005_notifications_appointments"),
    ]

    operations = [
        migrations.AddField(
            model_name="citizennotification",
            name="is_important",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name="citizennotification",
            name="email_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="citizennotification",
            name="email_last_error",
            field=models.TextField(blank=True),
        ),
    ]
