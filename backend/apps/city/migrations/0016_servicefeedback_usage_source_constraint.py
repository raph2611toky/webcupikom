from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("city", "0015_engagement_support_feedback_privacy"),
    ]

    operations = [
        migrations.AlterField(
            model_name="servicefeedback",
            name="source_appointment",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.RESTRICT,
                related_name="service_feedbacks",
                to="city.citizenappointment",
            ),
        ),
        migrations.AlterField(
            model_name="servicefeedback",
            name="source_request",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.RESTRICT,
                related_name="service_feedbacks",
                to="city.citizenrequest",
            ),
        ),
        migrations.AddConstraint(
            model_name="servicefeedback",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(source_request__isnull=False, source_appointment__isnull=True)
                    | models.Q(source_request__isnull=True, source_appointment__isnull=False)
                ),
                name="service_feedback_exactly_one_usage_source",
            ),
        ),
    ]
