from django.db import migrations, models


def assign_existing_roles(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.filter(is_superuser=True).update(role="admin", is_staff=True)
    User.objects.filter(is_superuser=False, is_staff=True).update(role="admin", is_staff=True)
    User.objects.filter(is_superuser=False, is_staff=False).update(role="citizen", is_staff=False)


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("citizen", "Citoyen"),
                    ("agent", "Agent municipal"),
                    ("admin", "Administrateur"),
                ],
                default="citizen",
                max_length=16,
                verbose_name="rôle",
            ),
        ),
        migrations.RunPython(assign_existing_roles, migrations.RunPython.noop),
    ]
