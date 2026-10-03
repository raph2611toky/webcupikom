import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("users", "0002_user_role"),
    ]

    operations = [
        migrations.CreateModel(
            name="MunicipalService",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=160)),
                ("slug", models.SlugField(max_length=180, unique=True)),
                ("category", models.CharField(blank=True, max_length=100)),
                ("short_description", models.CharField(max_length=280)),
                ("description", models.TextField(blank=True)),
                ("opening_hours", models.CharField(blank=True, max_length=160)),
                ("phone", models.CharField(blank=True, max_length=50)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("address", models.CharField(blank=True, max_length=255)),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "service municipal",
                "verbose_name_plural": "services municipaux",
                "ordering": ("sort_order", "name"),
            },
        ),
        migrations.CreateModel(
            name="NewsArticle",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=220)),
                ("slug", models.SlugField(max_length=240, unique=True)),
                ("category", models.CharField(blank=True, max_length=100)),
                ("excerpt", models.CharField(blank=True, max_length=320)),
                ("content", models.TextField()),
                ("is_published", models.BooleanField(default=True)),
                ("published_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "actualité",
                "verbose_name_plural": "actualités",
                "ordering": ("-published_at",),
            },
        ),
        migrations.CreateModel(
            name="WebCupRequestSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("external_id", models.PositiveIntegerField(blank=True, null=True)),
                ("request_code", models.CharField(max_length=32, unique=True)),
                ("requester_name", models.CharField(blank=True, max_length=220)),
                ("requester_type", models.CharField(blank=True, max_length=100)),
                ("message_public", models.TextField(blank=True)),
                ("difficulty", models.CharField(blank=True, max_length=50)),
                ("difficulty_level", models.PositiveSmallIntegerField(default=0)),
                ("xp_base", models.IntegerField(default=0)),
                ("xp_time_bonus", models.IntegerField(default=0)),
                ("xp_total", models.IntegerField(default=0)),
                ("xp_available", models.IntegerField(default=0)),
                ("is_ai_related", models.BooleanField(default=False)),
                ("arrival_type", models.CharField(blank=True, max_length=50)),
                ("wave_number", models.IntegerField(blank=True, null=True)),
                ("arrival_time", models.CharField(blank=True, max_length=100)),
                ("group_name", models.CharField(blank=True, max_length=120)),
                ("sort_order", models.IntegerField(default=0)),
                ("is_initial", models.BooleanField(default=False)),
                ("is_ai_request", models.BooleanField(default=False)),
                ("visible_since_wave", models.IntegerField(default=0)),
                ("is_visible", models.BooleanField(default=True)),
                ("raw_payload", models.JSONField(blank=True, default=dict)),
                ("first_seen_at", models.DateTimeField(auto_now_add=True)),
                ("last_seen_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "demande WebCup",
                "verbose_name_plural": "demandes WebCup",
                "ordering": ("sort_order", "external_id", "request_code"),
            },
        ),
        migrations.CreateModel(
            name="WebCupSyncState",
            fields=[
                ("key", models.CharField(default="requests", editable=False, max_length=32, primary_key=True, serialize=False)),
                ("api_version", models.CharField(blank=True, max_length=32)),
                ("session", models.JSONField(blank=True, default=dict)),
                ("last_success_at", models.DateTimeField(blank=True, null=True)),
                ("last_error", models.TextField(blank=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "état de synchronisation WebCup",
                "verbose_name_plural": "états de synchronisation WebCup",
            },
        ),
        migrations.CreateModel(
            name="ContactMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reference", models.CharField(editable=False, max_length=32, unique=True)),
                ("name", models.CharField(max_length=160)),
                ("email", models.EmailField(max_length=254)),
                ("subject", models.CharField(max_length=220)),
                ("message", models.TextField()),
                ("status", models.CharField(choices=[("received", "Reçu"), ("read", "Lu"), ("closed", "Clôturé")], default="received", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("service", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="contact_messages", to="city.municipalservice")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="contact_messages", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "message citoyen",
                "verbose_name_plural": "messages citoyens",
                "ordering": ("-created_at",),
            },
        ),
        migrations.CreateModel(
            name="CitizenRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reference", models.CharField(editable=False, max_length=32, unique=True)),
                ("title", models.CharField(max_length=220)),
                ("description", models.TextField()),
                ("status", models.CharField(choices=[("submitted", "Envoyée"), ("pending", "À traiter"), ("in_progress", "En traitement"), ("action_required", "Action requise"), ("completed", "Terminée")], default="pending", max_length=24)),
                ("priority", models.CharField(choices=[("low", "Basse"), ("normal", "Normale"), ("high", "Haute"), ("urgent", "Urgente")], default="normal", max_length=12)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("assigned_to", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="assigned_citizen_requests", to=settings.AUTH_USER_MODEL)),
                ("citizen", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="citizen_requests", to=settings.AUTH_USER_MODEL)),
                ("service", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="citizen_requests", to="city.municipalservice")),
            ],
            options={
                "verbose_name": "demande citoyenne",
                "verbose_name_plural": "demandes citoyennes",
                "ordering": ("-updated_at", "-created_at"),
            },
        ),
    ]
