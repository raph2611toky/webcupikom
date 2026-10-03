"""System checks spécifiques au déploiement Terra Nova."""

import sys

from django.core.checks import Warning, register
from django.db import DEFAULT_DB_ALIAS, connections
from django.db.migrations.executor import MigrationExecutor


@register()
def pending_terra_nova_migrations(app_configs, **kwargs):
    """Signale les migrations users/city non appliquées avant le redémarrage.

    Cela permet à ``python manage.py check`` de détecter un déploiement où le
    code attend de nouvelles colonnes mais où ``migrate`` n'a pas encore été
    exécuté.
    """

    if any(command in sys.argv for command in ("migrate", "makemigrations", "test")):
        return []

    try:
        connection = connections[DEFAULT_DB_ALIAS]
        executor = MigrationExecutor(connection)
        targets = executor.loader.graph.leaf_nodes()
        plan = executor.migration_plan(targets)
    except Exception:
        # Les contrôles standards de Django signaleront séparément les erreurs
        # de connexion. Ne transformons pas un check de confort en panne WSGI.
        return []

    pending = [
        f"{migration.app_label}.{migration.name}"
        for migration, _backwards in plan
        if migration.app_label in {"users", "city"}
    ]
    if not pending:
        return []

    return [
        Warning(
            "Des migrations Terra Nova ne sont pas encore appliquées : " + ", ".join(pending),
            hint="Exécutez `python manage.py migrate --noinput` avant de redémarrer Passenger.",
            id="city.W001",
        )
    ]
