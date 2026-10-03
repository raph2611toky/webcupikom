from django.core.management.base import BaseCommand

from apps.city.models import CityLocation, MunicipalService


class Command(BaseCommand):
    help = "Crée quelques lieux de démonstration Nova Terra pour F36/F45/F46."

    def handle(self, *args, **options):
        transport = MunicipalService.objects.filter(slug="transport").first()
        examples = [
            {
                "slug": "nova-centre-mobilite",
                "name": "Pôle mobilité Nova Centre",
                "kind": CityLocation.Kind.TRANSPORT_STOP,
                "category": "Mobilité",
                "description": "Point d'information et correspondance des transports municipaux.",
                "service": transport,
                "address": "Nova Centre",
                "district": "Nova Centre",
                "opening_hours": "06:00–22:00",
                "transport_lines": ["T1", "T2"],
                "timetable": [
                    {"line": "T1", "information": "Horaires à renseigner par l'administration"},
                    {"line": "T2", "information": "Horaires à renseigner par l'administration"},
                ],
            },
            {
                "slug": "hopital-municipal-nova",
                "name": "Hôpital municipal de Nova Terra",
                "kind": CityLocation.Kind.HOSPITAL,
                "category": "Santé",
                "address": "Nova Terra",
                "district": "Nova Centre",
                "opening_hours": "24h/24 pour les urgences",
                "practical_info": {"demo": True, "note": "Coordonnées et contacts à compléter par l'administration."},
            },
            {
                "slug": "urgence-municipale-nova",
                "name": "Service d'urgence municipal",
                "kind": CityLocation.Kind.EMERGENCY,
                "category": "Urgence",
                "address": "Nova Terra",
                "district": "Nova Centre",
                "opening_hours": "24h/24",
                "practical_info": {"demo": True, "note": "Coordonnées et contacts à compléter par l'administration."},
            },
        ]
        created = 0
        for payload in examples:
            _, was_created = CityLocation.objects.update_or_create(slug=payload["slug"], defaults=payload)
            created += int(was_created)
        self.stdout.write(self.style.SUCCESS(f"Lieux de démonstration prêts. Nouveaux : {created}."))
