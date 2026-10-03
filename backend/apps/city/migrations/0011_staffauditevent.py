import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("city", "0010_newsdistrict"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="StaffAuditEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("actor_role", models.CharField(blank=True, max_length=16)),
                ("action", models.CharField(db_index=True, max_length=80)),
                ("resource_type", models.CharField(db_index=True, max_length=40)),
                ("resource_id", models.CharField(blank=True, db_index=True, max_length=80)),
                ("resource_reference", models.CharField(blank=True, db_index=True, max_length=120)),
                ("summary", models.CharField(max_length=300)),
                ("changes", models.JSONField(blank=True, default=dict)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("visibility", models.CharField(choices=[("staff", "Agents et administrateurs"), ("admin", "Administrateurs uniquement")], db_index=True, default="staff", max_length=16)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="staff_audit_events", to=settings.AUTH_USER_MODEL)),
                ("subject_user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="staff_audit_subject_events", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "trace d'activité agent",
                "verbose_name_plural": "traces d'activité agents",
                "ordering": ("-created_at", "-id"),
                "indexes": [
                    models.Index(fields=["resource_type", "resource_id", "created_at"], name="city_audit_resource_idx"),
                    models.Index(fields=["actor", "created_at"], name="city_audit_actor_idx"),
                ],
            },
        ),
    ]
