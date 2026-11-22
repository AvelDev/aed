from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0075_add_performance_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="resource",
            name="contains_aed_data",
            field=models.BooleanField(
                default=False,
                help_text="Resource in the AED template; it is included in the combined AED list.",
                verbose_name="Contains AED defibrillator data",
            ),
        ),
    ]
