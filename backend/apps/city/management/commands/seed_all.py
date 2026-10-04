from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.test.utils import override_settings


class Command(BaseCommand):
    help = "Exécute tous les seeders Nova Terra dans l'ordre recommandé."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-passwords",
            action="store_true",
            help="Réinitialise les mots de passe des comptes de démonstration existants.",
        )
        parser.add_argument(
            "--with-realtime",
            action="store_true",
            help="Autorise exceptionnellement les publications temps réel pendant le seed.",
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("Seed Nova Terra"))

        # Les seeders remplissent la base ; ils ne doivent pas lancer de tâches
        # WebSocket asynchrones qui peuvent survivre à la commande manage.py.
        realtime_enabled = bool(options.get("with_realtime"))
        # Un seeder ne doit jamais déclencher de diffusion externe involontaire.
        # Le realtime et le fallback email des signalements sont neutralisés ici.
        with override_settings(
            REALTIME_ENABLED=realtime_enabled,
            REPORT_EMAIL_FALLBACK_ENABLED=False,
        ):
            self.stdout.write("1/3 — Lieux municipaux")
            call_command("seed_city_locations", verbosity=options.get("verbosity", 1))

            self.stdout.write("2/3 — Projets municipaux de base")
            call_command("seed_municipal_projects", verbosity=options.get("verbosity", 1))

            self.stdout.write("3/3 — Données de démonstration complètes")
            command_options = {"verbosity": options.get("verbosity", 1)}
            if options.get("reset_passwords"):
                command_options["reset_passwords"] = True
            call_command("seed_demo_data", **command_options)

        self.stdout.write(self.style.SUCCESS("Tous les seeders Nova Terra ont été exécutés."))
