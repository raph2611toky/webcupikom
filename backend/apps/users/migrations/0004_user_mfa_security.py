from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0003_registration_profile_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="mfa_enabled",
            field=models.BooleanField(default=False, verbose_name="MFA activé"),
        ),
        migrations.AddField(
            model_name="user",
            name="mfa_secret_encrypted",
            field=models.TextField(blank=True, default="", verbose_name="secret MFA chiffré"),
        ),
        migrations.AddField(
            model_name="user",
            name="mfa_recovery_codes",
            field=models.JSONField(blank=True, default=list, verbose_name="codes de récupération MFA"),
        ),
        migrations.AddField(
            model_name="user",
            name="mfa_confirmed_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="MFA confirmé le"),
        ),
        migrations.AddField(
            model_name="user",
            name="mfa_last_used_counter",
            field=models.BigIntegerField(blank=True, null=True, verbose_name="dernier compteur TOTP utilisé"),
        ),
        migrations.AddField(
            model_name="user",
            name="mfa_login_nonce",
            field=models.CharField(blank=True, default="", max_length=128, verbose_name="nonce de challenge MFA"),
        ),
        migrations.AddField(
            model_name="user",
            name="auth_token_version",
            field=models.PositiveIntegerField(default=0, verbose_name="version de sécurité JWT"),
        ),
    ]
