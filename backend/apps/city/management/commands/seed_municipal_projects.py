from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.city.models import MunicipalProject


class Command(BaseCommand):
    help = "Crée ou met à jour trois projets municipaux de démonstration Nova Terra."

    def handle(self, *args, **options):
        now = timezone.now()
        projects = [
            {
                "slug": "parc-urbain-nova-centre",
                "defaults": {
                    "title": "Parc urbain Nova Centre",
                    "short_description": "Création d'un nouvel espace vert et d'une zone piétonne.",
                    "description": "Réaménagement du quartier central avec création d'espaces verts et zones piétonnes.",
                    "district": "Nova Centre",
                    "status": MunicipalProject.Status.IN_PROGRESS,
                    "progress": 70,
                    "start_date": timezone.localdate().replace(month=3, day=1),
                    "expected_end_date": timezone.localdate().replace(month=11, day=30),
                    "objectives": [
                        "Créer un espace vert",
                        "Améliorer les déplacements piétons",
                        "Créer des espaces de rencontre",
                    ],
                    "milestones": [
                        {"title": "Étude terminée", "status": "completed"},
                        {"title": "Travaux préparatoires", "status": "completed"},
                        {"title": "Aménagement des espaces verts", "status": "current"},
                        {"title": "Installation du mobilier", "status": "pending"},
                    ],
                    "participation_type": MunicipalProject.ParticipationType.CONSULTATION,
                    "participation_question": "Que pensez-vous de ce projet ?",
                    "participation_options": [
                        {"value": "very_favorable", "label": "Très favorable"},
                        {"value": "favorable", "label": "Favorable"},
                        {"value": "neutral", "label": "Neutre"},
                        {"value": "unfavorable", "label": "Défavorable"},
                    ],
                    "participation_opens_at": now - timedelta(days=7),
                    "participation_closes_at": now + timedelta(days=30),
                    "support_enabled": True,
                    "is_published": True,
                },
            },
            {
                "slug": "mobilite-est",
                "defaults": {
                    "title": "Mobilité Est",
                    "short_description": "Amélioration des déplacements dans les quartiers de l'Est.",
                    "description": "Projet d'aménagement de nouvelles liaisons cyclables et piétonnes.",
                    "district": "Nova Est",
                    "status": MunicipalProject.Status.PLANNED,
                    "progress": 25,
                    "objectives": [
                        "Sécuriser les déplacements",
                        "Développer les mobilités douces",
                    ],
                    "milestones": [
                        {"title": "Diagnostic de mobilité", "status": "completed"},
                        {"title": "Consultation citoyenne", "status": "current"},
                        {"title": "Travaux", "status": "pending"},
                    ],
                    "participation_type": MunicipalProject.ParticipationType.DECISION,
                    "participation_question": "Faut-il intégrer une piste cyclable continue au projet Mobilité Est ?",
                    "participation_options": [
                        {"value": "yes", "label": "Oui"},
                        {"value": "no", "label": "Non"},
                        {"value": "no_opinion", "label": "Sans avis"},
                    ],
                    "participation_opens_at": now - timedelta(days=2),
                    "participation_closes_at": now + timedelta(days=7),
                    "support_enabled": True,
                    "is_published": True,
                },
            },
            {
                "slug": "centre-de-sante-nova-sud",
                "defaults": {
                    "title": "Centre de santé Nova Sud",
                    "short_description": "Création d'un nouveau centre de santé de proximité.",
                    "description": "Construction et mise en service d'un centre de santé municipal à Nova Sud.",
                    "district": "Nova Sud",
                    "status": MunicipalProject.Status.IN_PROGRESS,
                    "progress": 45,
                    "objectives": [
                        "Rapprocher les soins des habitants",
                        "Améliorer l'accueil de proximité",
                    ],
                    "milestones": [
                        {"title": "Études", "status": "completed"},
                        {"title": "Construction", "status": "current"},
                        {"title": "Équipement", "status": "pending"},
                    ],
                    "participation_type": MunicipalProject.ParticipationType.NONE,
                    "participation_question": "",
                    "participation_options": [],
                    "support_enabled": True,
                    "is_published": True,
                },
            },
        ]

        created = 0
        updated = 0
        for payload in projects:
            _, was_created = MunicipalProject.objects.update_or_create(
                slug=payload["slug"], defaults=payload["defaults"]
            )
            created += int(was_created)
            updated += int(not was_created)

        self.stdout.write(
            self.style.SUCCESS(
                f"Projets municipaux prêts : {created} créé(s), {updated} mis à jour."
            )
        )
