import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("city", "0011_staffauditevent"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MunicipalProject",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=220)),
                ("slug", models.SlugField(max_length=240, unique=True)),
                ("short_description", models.CharField(blank=True, max_length=320)),
                ("description", models.TextField()),
                ("district", models.CharField(blank=True, db_index=True, max_length=120)),
                ("status", models.CharField(choices=[("planned", "Planifié"), ("in_progress", "En cours"), ("paused", "En pause"), ("completed", "Terminé"), ("cancelled", "Annulé")], db_index=True, default="planned", max_length=20)),
                ("progress", models.PositiveSmallIntegerField(default=0)),
                ("start_date", models.DateField(blank=True, null=True)),
                ("expected_end_date", models.DateField(blank=True, null=True)),
                ("actual_end_date", models.DateField(blank=True, null=True)),
                ("objectives", models.JSONField(blank=True, default=list)),
                ("milestones", models.JSONField(blank=True, default=list)),
                ("participation_type", models.CharField(choices=[("none", "Aucune"), ("consultation", "Consultation"), ("decision", "Décision citoyenne")], db_index=True, default="none", max_length=20)),
                ("participation_question", models.CharField(blank=True, max_length=320)),
                ("participation_options", models.JSONField(blank=True, default=list)),
                ("participation_opens_at", models.DateTimeField(blank=True, null=True)),
                ("participation_closes_at", models.DateTimeField(blank=True, null=True)),
                ("support_enabled", models.BooleanField(default=True)),
                ("is_published", models.BooleanField(db_index=True, default=False)),
                ("published_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_municipal_projects", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "projet municipal",
                "verbose_name_plural": "projets municipaux",
                "ordering": ("-is_published", "-updated_at", "title"),
                "indexes": [
                    models.Index(fields=["is_published", "status"], name="city_proj_pub_status_idx"),
                    models.Index(fields=["participation_type", "participation_closes_at"], name="city_proj_part_close_idx"),
                ],
                "constraints": [
                    models.CheckConstraint(condition=models.Q(("progress__gte", 0), ("progress__lte", 100)), name="city_project_progress_0_100"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ProjectContribution",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reference", models.CharField(editable=False, max_length=40, unique=True)),
                ("contribution_type", models.CharField(choices=[("consultation", "Consultation"), ("decision", "Décision citoyenne")], max_length=20)),
                ("question_snapshot", models.CharField(blank=True, max_length=320)),
                ("choice", models.CharField(max_length=80)),
                ("choice_label_snapshot", models.CharField(blank=True, max_length=160)),
                ("comment", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("citizen", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="municipal_project_contributions", to=settings.AUTH_USER_MODEL)),
                ("project", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="contributions", to="city.municipalproject")),
            ],
            options={
                "verbose_name": "participation à un projet",
                "verbose_name_plural": "participations aux projets",
                "ordering": ("-created_at", "-id"),
                "indexes": [
                    models.Index(fields=["project", "contribution_type", "created_at"], name="city_proj_contrib_idx"),
                ],
                "constraints": [
                    models.UniqueConstraint(fields=("project", "citizen", "contribution_type"), name="unique_project_citizen_contribution_type"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ProjectSupport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("citizen", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="municipal_project_supports", to=settings.AUTH_USER_MODEL)),
                ("project", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="supports", to="city.municipalproject")),
            ],
            options={
                "verbose_name": "soutien à un projet",
                "verbose_name_plural": "soutiens aux projets",
                "ordering": ("-created_at", "-id"),
                "constraints": [
                    models.UniqueConstraint(fields=("project", "citizen"), name="unique_project_citizen_support"),
                ],
            },
        ),
        migrations.CreateModel(
            name="MunicipalIdea",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reference", models.CharField(editable=False, max_length=32, unique=True)),
                ("title", models.CharField(max_length=220)),
                ("category", models.CharField(max_length=100)),
                ("district", models.CharField(blank=True, db_index=True, max_length=120)),
                ("description", models.TextField()),
                ("status", models.CharField(choices=[("submitted", "Envoyée"), ("under_review", "À l'étude"), ("accepted", "Retenue"), ("rejected", "Non retenue"), ("implemented", "Mise en œuvre")], db_index=True, default="submitted", max_length=20)),
                ("staff_note", models.TextField(blank=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("citizen", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="municipal_ideas", to=settings.AUTH_USER_MODEL)),
                ("project", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="citizen_ideas", to="city.municipalproject")),
                ("reviewed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reviewed_municipal_ideas", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "idée citoyenne",
                "verbose_name_plural": "idées citoyennes",
                "ordering": ("-created_at", "-id"),
                "indexes": [
                    models.Index(fields=["status", "created_at"], name="city_idea_status_idx"),
                    models.Index(fields=["project", "created_at"], name="city_idea_project_idx"),
                ],
            },
        ),
    ]
