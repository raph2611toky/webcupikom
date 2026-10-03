from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0002_user_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="profession",
            field=models.CharField(blank=True, max_length=120, verbose_name="profession"),
        ),
        migrations.AddField(
            model_name="user",
            name="gender",
            field=models.CharField(
                blank=True,
                choices=[
                    ("female", "Femme"),
                    ("male", "Homme"),
                    ("other", "Autre"),
                    ("prefer_not_to_say", "Préfère ne pas répondre"),
                ],
                max_length=24,
                verbose_name="sexe / genre",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="birth_date",
            field=models.DateField(blank=True, null=True, verbose_name="date de naissance"),
        ),
        migrations.AddField(
            model_name="user",
            name="address",
            field=models.CharField(blank=True, max_length=255, verbose_name="adresse"),
        ),
        migrations.AddField(
            model_name="user",
            name="habitat",
            field=models.CharField(blank=True, max_length=120, verbose_name="habitat"),
        ),
        migrations.AddField(
            model_name="user",
            name="district",
            field=models.CharField(blank=True, max_length=120, verbose_name="quartier / district"),
        ),
        migrations.AddField(
            model_name="user",
            name="sector",
            field=models.CharField(blank=True, max_length=120, verbose_name="secteur"),
        ),
        migrations.AddField(
            model_name="user",
            name="street",
            field=models.CharField(blank=True, max_length=160, verbose_name="rue"),
        ),
        migrations.AddField(
            model_name="user",
            name="building",
            field=models.CharField(blank=True, max_length=120, verbose_name="bâtiment"),
        ),
        migrations.AddField(
            model_name="user",
            name="apartment",
            field=models.CharField(blank=True, max_length=80, verbose_name="appartement"),
        ),
        migrations.AddField(
            model_name="user",
            name="registration_profile_completed_at",
            field=models.DateTimeField(
                blank=True, null=True, verbose_name="profil d'inscription complété le"
            ),
        ),
    ]
