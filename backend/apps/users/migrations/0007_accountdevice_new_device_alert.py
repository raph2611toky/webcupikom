import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0006_securityevent"),
    ]

    operations = [
        migrations.CreateModel(
            name="AccountDevice",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("token_hash", models.CharField(max_length=64)),
                ("label", models.CharField(blank=True, max_length=160)),
                ("user_agent", models.CharField(blank=True, max_length=512)),
                ("first_seen_at", models.DateTimeField(auto_now_add=True)),
                ("last_seen_at", models.DateTimeField(auto_now_add=True)),
                ("last_login_at", models.DateTimeField(auto_now_add=True)),
                ("last_ip_address", models.GenericIPAddressField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="account_devices",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ("-last_login_at",),
                "indexes": [models.Index(fields=["user", "last_seen_at"], name="users_accdev_user_seen_idx")],
                "constraints": [
                    models.UniqueConstraint(fields=("user", "token_hash"), name="unique_account_device_token")
                ],
            },
        ),
        migrations.AddField(
            model_name="accountsession",
            name="device",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="sessions",
                to="users.accountdevice",
            ),
        ),
        migrations.AddField(
            model_name="accountsession",
            name="is_new_device_login",
            field=models.BooleanField(default=False),
        ),
    ]
