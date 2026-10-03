from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("city", "0013_service_availability_f63_f64"),
    ]

    operations = [
        migrations.CreateModel(
            name="CityLocation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=180)),
                ("slug", models.SlugField(max_length=200, unique=True)),
                ("kind", models.CharField(choices=[("service", "Service municipal"), ("transport_stop", "Arrêt / point de transport"), ("hospital", "Hôpital / établissement de santé"), ("emergency", "Service d'urgence"), ("partner", "Partenaire")], default="service", max_length=30)),
                ("category", models.CharField(blank=True, max_length=100)),
                ("description", models.TextField(blank=True)),
                ("partner_name", models.CharField(blank=True, max_length=180)),
                ("address", models.CharField(blank=True, max_length=255)),
                ("district", models.CharField(blank=True, max_length=120)),
                ("opening_hours", models.CharField(blank=True, max_length=180)),
                ("phone", models.CharField(blank=True, max_length=50)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("website", models.URLField(blank=True, max_length=500)),
                ("latitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("longitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("transport_lines", models.JSONField(blank=True, default=list)),
                ("timetable", models.JSONField(blank=True, default=list)),
                ("practical_info", models.JSONField(blank=True, default=dict)),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("service", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="locations", to="city.municipalservice")),
            ],
            options={
                "verbose_name": "lieu municipal / partenaire",
                "verbose_name_plural": "lieux municipaux / partenaires",
                "ordering": ("sort_order", "name"),
            },
        ),
        migrations.AddIndex(
            model_name="citylocation",
            index=models.Index(fields=["kind", "is_active"], name="cityloc_kind_active_idx"),
        ),
        migrations.AddIndex(
            model_name="citylocation",
            index=models.Index(fields=["district", "is_active"], name="cityloc_dist_active_idx"),
        ),
    ]
