from __future__ import annotations

import os
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models.signals import post_save
from django.utils import timezone

from apps.city.models import (
    CitizenAppointment,
    CitizenNotification,
    CitizenRequest,
    CitizenRequestEvent,
    ContactMessage,
    MunicipalIdea,
    MunicipalProject,
    MunicipalService,
    NewsArticle,
    ProjectContribution,
    ProjectSupport,
    ReportAlertDispatch,
    ServiceFeedback,
)
from apps.city.services.report_alerting import build_report_alert_payload
from apps.city.report_signals import ensure_emergency_alert_outbox
from apps.users.models import User


DEFAULT_PASSWORD = "NovaTerra2026!"


class Command(BaseCommand):
    help = (
        "Crée ou met à jour les données de démonstration Nova Terra : agents, citoyens, "
        "signalements, alertes, rendez-vous, projets, publications, notifications et participation."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-passwords",
            action="store_true",
            help="Réinitialise aussi les mots de passe des comptes de démonstration existants.",
        )

    def handle(self, *args, **options):
        self.reset_passwords = bool(options["reset_passwords"])
        self.agent_password = os.getenv("SEED_AGENT_PASSWORD", DEFAULT_PASSWORD)
        self.citizen_password = os.getenv("SEED_CITIZEN_PASSWORD", DEFAULT_PASSWORD)
        self.now = timezone.now()

        with transaction.atomic():
            services = self.seed_services()
            users = self.seed_users()
            projects = self.seed_projects(users)

            # Le seeder doit rester déterministe et ne jamais dépendre de Redis.
            # On suspend uniquement le signal de diffusion F86 pendant la création
            # des signalements, puis on crée l'outbox de démonstration nous-mêmes.
            post_save.disconnect(ensure_emergency_alert_outbox, sender=CitizenRequest)
            try:
                requests = self.seed_requests(users, services)
            finally:
                post_save.connect(ensure_emergency_alert_outbox, sender=CitizenRequest)

            self.seed_request_events(users, requests)
            appointments = self.seed_appointments(users, services)
            self.seed_publications(users, services)
            self.seed_participation(users, projects)
            self.seed_contacts(users, services)
            self.seed_notifications(users, requests, appointments)
            self.seed_feedback(users, services, requests, appointments)
            self.seed_alert_dispatches(requests)

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Seed de démonstration terminé."))
        self.stdout.write("Agents :")
        self.stdout.write("  - toky@gmail.com")
        self.stdout.write("  - nandrasana@gmail.com")
        self.stdout.write(
            "Mot de passe des nouveaux comptes : valeur de SEED_AGENT_PASSWORD "
            f"(défaut : {DEFAULT_PASSWORD})"
        )
        if not self.reset_passwords:
            self.stdout.write(
                "Les mots de passe des comptes déjà existants n'ont pas été modifiés. "
                "Utilisez --reset-passwords pour les réinitialiser."
            )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def upsert_user(self, email, *, password, **defaults):
        email = email.strip().lower()
        user, created = User.objects.get_or_create(email=email, defaults=defaults)
        changed = False
        for field, value in defaults.items():
            if getattr(user, field) != value:
                setattr(user, field, value)
                changed = True
        if created or self.reset_passwords or not user.has_usable_password():
            user.set_password(password)
            changed = True
        if changed:
            user.save()
        return user

    def service(self, services, slug):
        return services.get(slug)

    # ------------------------------------------------------------------
    # Services / utilisateurs
    # ------------------------------------------------------------------
    def seed_services(self):
        rows = [
            ("administration", "Administration", "Administration", "Démarches administratives et accompagnement des habitants."),
            ("transport", "Transport", "Transport", "Mobilité, voirie et déplacements à Nova Terra."),
            ("sante", "Santé", "Santé", "Orientation vers les services municipaux de santé."),
            ("habitat", "Habitat", "Habitat", "Logement, résidence et équipements municipaux."),
            ("energie", "Énergie", "Énergie", "Éclairage public et services énergétiques."),
            ("securite", "Sécurité", "Sécurité", "Sécurité des espaces publics et assistance municipale."),
            ("environnement", "Environnement", "Environnement", "Propreté, déchets et espaces verts."),
            ("eau", "Eau et assainissement", "Eau", "Réseau d'eau, fuites et assainissement."),
        ]
        services = {}
        for order, (slug, name, category, description) in enumerate(rows, start=1):
            obj, _ = MunicipalService.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "category": category,
                    "short_description": description,
                    "description": description,
                    "opening_hours": "Lun–Ven 08:00–17:00",
                    "email": f"{slug}@novaterra.local",
                    "phone": "+261 20 00 000 00",
                    "address": "Hôtel de Ville — Nova Centre",
                    "is_active": True,
                    "is_featured": slug in {"administration", "sante", "transport", "energie"},
                    "priority_order": order * 10,
                    "sort_order": order * 10,
                    "actions": [],
                    "required_documents": [],
                    "faq": [],
                    "translations": {},
                },
            )
            services[slug] = obj
        return services

    def seed_users(self):
        users = {}
        users["toky"] = self.upsert_user(
            "toky@gmail.com",
            password=self.agent_password,
            first_name="Toky",
            last_name="Rakoto",
            role=User.Role.AGENT,
            is_active=True,
            email_verified=True,
            profession="Agent municipal — Relation usagers",
            phone_number="+261 34 00 000 01",
            locale="fr",
        )
        users["nandrasana"] = self.upsert_user(
            "nandrasana@gmail.com",
            password=self.agent_password,
            first_name="Nandrasana",
            last_name="Ranaivo",
            role=User.Role.AGENT,
            is_active=True,
            email_verified=True,
            profession="Agent municipal — Services techniques",
            phone_number="+261 34 00 000 02",
            locale="fr",
        )

        citizens = [
            ("lucas.demo@novaterra.local", "Lucas", "Meyer", "Nova Centre", "Quartier Horizon"),
            ("sophie.demo@novaterra.local", "Sophie", "Nguyen", "Nova Est", "Avenue des Écoles"),
            ("amina.demo@novaterra.local", "Amina", "Rahal", "Nova Sud", "Rue des Acacias"),
            ("marc.demo@novaterra.local", "Marc", "Delcourt", "Nova Centre", "Rue du Marché"),
            ("elena.demo@novaterra.local", "Elena", "Martinez", "Nova Ouest", "Boulevard Horizon"),
        ]
        for index, (email, first_name, last_name, district, street) in enumerate(citizens, start=1):
            users[f"citizen{index}"] = self.upsert_user(
                email,
                password=self.citizen_password,
                first_name=first_name,
                last_name=last_name,
                role=User.Role.CITIZEN,
                is_active=True,
                email_verified=True,
                profession="Habitant de Nova Terra",
                district=district,
                address=f"{street}, {district}",
                street=street,
                locale="fr",
            )
        return users

    # ------------------------------------------------------------------
    # Projets
    # ------------------------------------------------------------------
    def seed_projects(self, users):
        now = self.now
        project_rows = [
            {
                "slug": "parc-urbain-nova-centre",
                "title": "Parc urbain Nova Centre",
                "short_description": "Création d'un espace vert, piéton et familial au cœur de Nova Centre.",
                "description": "Réaménagement d'une friche urbaine en parc municipal accessible et végétalisé.",
                "district": "Nova Centre",
                "status": MunicipalProject.Status.IN_PROGRESS,
                "progress": 70,
                "participation_type": MunicipalProject.ParticipationType.CONSULTATION,
                "participation_question": "Quelles améliorations souhaitez-vous pour le futur parc ?",
                "participation_options": [
                    {"value": "green", "label": "Plus d'espaces verts"},
                    {"value": "sport", "label": "Plus d'équipements sportifs"},
                    {"value": "family", "label": "Plus d'espaces familiaux"},
                ],
            },
            {
                "slug": "mobilite-est",
                "title": "Mobilité Est",
                "short_description": "Nouvelles liaisons piétonnes, cyclables et transports dans Nova Est.",
                "description": "Modernisation des déplacements et sécurisation des axes structurants de Nova Est.",
                "district": "Nova Est",
                "status": MunicipalProject.Status.PLANNED,
                "progress": 25,
                "participation_type": MunicipalProject.ParticipationType.DECISION,
                "participation_question": "Faut-il intégrer une piste cyclable continue au projet ?",
                "participation_options": [
                    {"value": "yes", "label": "Oui"},
                    {"value": "no", "label": "Non"},
                    {"value": "no_opinion", "label": "Sans avis"},
                ],
            },
            {
                "slug": "centre-de-sante-nova-sud",
                "title": "Centre de santé Nova Sud",
                "short_description": "Construction d'un centre de santé municipal de proximité.",
                "description": "Création d'un centre de santé accessible aux habitants de Nova Sud.",
                "district": "Nova Sud",
                "status": MunicipalProject.Status.IN_PROGRESS,
                "progress": 48,
                "participation_type": MunicipalProject.ParticipationType.NONE,
                "participation_question": "",
                "participation_options": [],
            },
            {
                "slug": "eclairage-intelligent-nova-centre",
                "title": "Éclairage intelligent Nova Centre",
                "short_description": "Remplacement progressif des lampadaires et suivi des pannes.",
                "description": "Déploiement d'un éclairage public plus fiable et moins énergivore.",
                "district": "Nova Centre",
                "status": MunicipalProject.Status.IN_PROGRESS,
                "progress": 38,
                "participation_type": MunicipalProject.ParticipationType.CONSULTATION,
                "participation_question": "Quels secteurs doivent être traités en priorité ?",
                "participation_options": [
                    {"value": "schools", "label": "Autour des écoles"},
                    {"value": "markets", "label": "Autour des marchés"},
                    {"value": "residential", "label": "Zones résidentielles"},
                ],
            },
        ]
        projects = {}
        for idx, row in enumerate(project_rows):
            project, _ = MunicipalProject.objects.update_or_create(
                slug=row["slug"],
                defaults={
                    **row,
                    "start_date": timezone.localdate() - timedelta(days=90 - idx * 10),
                    "expected_end_date": timezone.localdate() + timedelta(days=120 + idx * 25),
                    "objectives": [
                        "Améliorer le cadre de vie",
                        "Associer les habitants au projet",
                        "Suivre publiquement l'avancement",
                    ],
                    "milestones": [
                        {"title": "Études", "status": "completed"},
                        {"title": "Concertation", "status": "current"},
                        {"title": "Mise en œuvre", "status": "pending"},
                    ],
                    "participation_opens_at": now - timedelta(days=7) if row["participation_type"] != MunicipalProject.ParticipationType.NONE else None,
                    "participation_closes_at": now + timedelta(days=30) if row["participation_type"] != MunicipalProject.ParticipationType.NONE else None,
                    "support_enabled": True,
                    "is_published": True,
                    "published_at": now - timedelta(days=20 - idx),
                    "created_by": users["toky"] if idx % 2 == 0 else users["nandrasana"],
                },
            )
            projects[row["slug"]] = project
        return projects

    # ------------------------------------------------------------------
    # Demandes / signalements / F86
    # ------------------------------------------------------------------
    def seed_requests(self, users, services):
        now = self.now
        rows = [
            {
                "reference": "DEMO-RPT-001",
                "citizen": users["citizen1"],
                "service": self.service(services, "energie"),
                "request_type": CitizenRequest.RequestType.REPORT,
                "incident_category": "street_lighting",
                "title": "Lampadaire éteint devant l'école",
                "description": "Le lampadaire devant l'école du quartier Horizon ne fonctionne plus depuis trois nuits.",
                "location_text": "Rue des Écoles, Nova Centre",
                "district": "Nova Centre",
                "street": "Rue des Écoles",
                "latitude": Decimal("-18.879100"),
                "longitude": Decimal("47.507900"),
                "severity": "moderate",
                "frequency": "ongoing",
                "status": CitizenRequest.Status.PENDING,
                "priority": CitizenRequest.Priority.NORMAL,
                "handling_route": CitizenRequest.HandlingRoute.STANDARD,
                "alert_status": CitizenRequest.AlertStatus.NONE,
                "assigned_to": users["nandrasana"],
                "routing_source": "automatic",
            },
            {
                "reference": "DEMO-RPT-002",
                "citizen": users["citizen2"],
                "service": self.service(services, "transport"),
                "request_type": CitizenRequest.RequestType.REPORT,
                "incident_category": "road_damage",
                "title": "Nid-de-poule important avenue des Écoles",
                "description": "Un trou profond ralentit les véhicules et devient dangereux pour les vélos.",
                "location_text": "Avenue des Écoles, Nova Est",
                "district": "Nova Est",
                "street": "Avenue des Écoles",
                "severity": "major",
                "danger_present": False,
                "status": CitizenRequest.Status.IN_PROGRESS,
                "priority": CitizenRequest.Priority.HIGH,
                "handling_route": CitizenRequest.HandlingRoute.PRIORITY,
                "alert_status": CitizenRequest.AlertStatus.NONE,
                "assigned_to": users["nandrasana"],
                "routing_source": "automatic",
                "acknowledged_at": now - timedelta(hours=3),
            },
            {
                "reference": "DEMO-RPT-003",
                "citizen": users["citizen3"],
                "service": self.service(services, "eau"),
                "request_type": CitizenRequest.RequestType.REPORT,
                "incident_category": "water_leak",
                "title": "Fuite d'eau sur la chaussée",
                "description": "De l'eau coule continuellement depuis une canalisation près de la place du Sud.",
                "location_text": "Place du Sud, Nova Sud",
                "district": "Nova Sud",
                "severity": "moderate",
                "status": CitizenRequest.Status.PENDING,
                "priority": CitizenRequest.Priority.NORMAL,
                "handling_route": CitizenRequest.HandlingRoute.STANDARD,
                "alert_status": CitizenRequest.AlertStatus.NONE,
                "assigned_to": users["toky"],
                "routing_source": "automatic",
            },
            {
                "reference": "DEMO-RPT-004",
                "citizen": users["citizen4"],
                "service": self.service(services, "environnement"),
                "request_type": CitizenRequest.RequestType.REPORT,
                "incident_category": "waste",
                "title": "Dépôt sauvage près du marché",
                "description": "Des déchets s'accumulent derrière le marché central depuis plusieurs jours.",
                "location_text": "Marché central, Nova Centre",
                "district": "Nova Centre",
                "severity": "minor",
                "status": CitizenRequest.Status.COMPLETED,
                "priority": CitizenRequest.Priority.NORMAL,
                "handling_route": CitizenRequest.HandlingRoute.STANDARD,
                "alert_status": CitizenRequest.AlertStatus.NONE,
                "assigned_to": users["toky"],
                "routing_source": "automatic",
                "resolution_summary": "L'équipe de propreté est intervenue et le dépôt a été retiré.",
                "resolved_at": now - timedelta(days=1),
                "closed_at": now - timedelta(days=1),
            },
            {
                "reference": "DEMO-RPT-005",
                "citizen": users["citizen5"],
                "service": self.service(services, "transport"),
                "request_type": CitizenRequest.RequestType.REPORT,
                "incident_category": "accessibility",
                "title": "Trottoir inaccessible aux fauteuils roulants",
                "description": "Le passage est bloqué par une bordure trop haute au carrefour Horizon.",
                "location_text": "Boulevard Horizon, Nova Ouest",
                "district": "Nova Ouest",
                "severity": "major",
                "impacts_accessibility": True,
                "accessibility_details": "Absence d'abaissement de trottoir.",
                "status": CitizenRequest.Status.IN_PROGRESS,
                "priority": CitizenRequest.Priority.HIGH,
                "handling_route": CitizenRequest.HandlingRoute.PRIORITY,
                "alert_status": CitizenRequest.AlertStatus.NONE,
                "assigned_to": users["nandrasana"],
                "routing_source": "automatic",
            },
            {
                "reference": "DEMO-RPT-URG-001",
                "citizen": users["citizen3"],
                "service": self.service(services, "sante"),
                "request_type": CitizenRequest.RequestType.REPORT,
                "incident_category": "medical_emergency",
                "title": "Urgence médicale signalée sur la place du Sud",
                "description": "Une personne est au sol et semble nécessiter une assistance immédiate.",
                "location_text": "Place du Sud, Nova Sud",
                "district": "Nova Sud",
                "severity": "critical",
                "danger_present": True,
                "people_affected": 1,
                "status": CitizenRequest.Status.PENDING,
                "priority": CitizenRequest.Priority.URGENT,
                "handling_route": CitizenRequest.HandlingRoute.EMERGENCY,
                "alert_status": CitizenRequest.AlertStatus.PENDING,
                "alert_triggered_at": now - timedelta(minutes=7),
                "assigned_to": users["toky"],
                "routing_source": "automatic",
            },
            {
                "reference": "DEMO-RPT-URG-002",
                "citizen": users["citizen1"],
                "service": self.service(services, "securite"),
                "request_type": CitizenRequest.RequestType.REPORT,
                "incident_category": "fire_emergency",
                "title": "Départ de feu dans une poubelle publique",
                "description": "Un départ de feu a été signalé près de la gare et a été pris en charge.",
                "location_text": "Gare Nova Centre",
                "district": "Nova Centre",
                "severity": "critical",
                "danger_present": True,
                "status": CitizenRequest.Status.IN_PROGRESS,
                "priority": CitizenRequest.Priority.URGENT,
                "handling_route": CitizenRequest.HandlingRoute.EMERGENCY,
                "alert_status": CitizenRequest.AlertStatus.ACKNOWLEDGED,
                "alert_triggered_at": now - timedelta(hours=2),
                "alert_acknowledged_at": now - timedelta(hours=2, minutes=-3),
                "alert_acknowledged_by": users["nandrasana"],
                "acknowledged_at": now - timedelta(hours=2, minutes=-3),
                "assigned_to": users["nandrasana"],
                "routing_source": "automatic",
            },
            {
                "reference": "DEMO-REQ-001",
                "citizen": users["citizen2"],
                "service": self.service(services, "administration"),
                "request_type": CitizenRequest.RequestType.PROCEDURE,
                "title": "Demande d'attestation de résidence",
                "description": "Je souhaite obtenir une attestation de résidence pour mon dossier scolaire.",
                "district": "Nova Est",
                "status": CitizenRequest.Status.ACTION_REQUIRED,
                "priority": CitizenRequest.Priority.NORMAL,
                "handling_route": CitizenRequest.HandlingRoute.STANDARD,
                "alert_status": CitizenRequest.AlertStatus.NONE,
                "assigned_to": users["toky"],
                "resolution_summary": "Merci de joindre un justificatif de domicile récent.",
            },
            {
                "reference": "DEMO-REQ-002",
                "citizen": users["citizen5"],
                "service": self.service(services, "habitat"),
                "request_type": CitizenRequest.RequestType.PROCEDURE,
                "title": "Demande d'information logement",
                "description": "Je souhaite connaître les aides municipales disponibles pour améliorer mon logement.",
                "district": "Nova Ouest",
                "status": CitizenRequest.Status.COMPLETED,
                "priority": CitizenRequest.Priority.LOW,
                "handling_route": CitizenRequest.HandlingRoute.STANDARD,
                "alert_status": CitizenRequest.AlertStatus.NONE,
                "assigned_to": users["toky"],
                "resolution_summary": "Les informations et critères d'éligibilité ont été transmis.",
                "resolved_at": now - timedelta(days=3),
                "closed_at": now - timedelta(days=3),
            },
        ]

        result = {}
        for row in rows:
            reference = row.pop("reference")
            obj, _ = CitizenRequest.objects.update_or_create(reference=reference, defaults=row)
            result[reference] = obj
        return result

    def seed_request_events(self, users, requests):
        rows = [
            ("DEMO-RPT-002", CitizenRequestEvent.EventType.STATUS, users["nandrasana"], "Signalement pris en charge", "Une équipe technique analyse la dégradation de la chaussée.", True),
            ("DEMO-RPT-003", CitizenRequestEvent.EventType.REPLY, users["toky"], "Réponse de l'équipe municipale", "Votre signalement est enregistré. Une vérification du réseau d'eau est programmée.", True),
            ("DEMO-REQ-001", CitizenRequestEvent.EventType.REPLY, users["toky"], "Document complémentaire demandé", "Merci de joindre un justificatif de domicile récent pour finaliser la demande.", True),
            ("DEMO-RPT-URG-001", CitizenRequestEvent.EventType.NOTE, users["toky"], "Alerte transmise aux agents", "Le signalement est placé dans le circuit d'urgence.", False),
            ("DEMO-RPT-URG-002", CitizenRequestEvent.EventType.STATUS, users["nandrasana"], "Alerte prise en charge", "Un agent a accusé réception de l'alerte et coordonne l'intervention.", False),
        ]
        for ref, event_type, actor, title, message, public in rows:
            request = requests[ref]
            CitizenRequestEvent.objects.update_or_create(
                request=request,
                event_type=event_type,
                title=title,
                defaults={
                    "actor": actor,
                    "status": request.status,
                    "message": message,
                    "is_public": public,
                },
            )

    # ------------------------------------------------------------------
    # Rendez-vous
    # ------------------------------------------------------------------
    def seed_appointments(self, users, services):
        now = self.now
        rows = [
            ("DEMO-APT-001", users["citizen1"], users["toky"], "administration", 1, 9, CitizenAppointment.Status.CONFIRMED, "Dossier administratif"),
            ("DEMO-APT-002", users["citizen2"], users["nandrasana"], "transport", 2, 14, CitizenAppointment.Status.CONFIRMED, "Échange sur un signalement de voirie"),
            ("DEMO-APT-003", users["citizen3"], users["toky"], "sante", 4, 10, CitizenAppointment.Status.REQUESTED, "Orientation santé"),
            ("DEMO-APT-004", users["citizen4"], users["toky"], "administration", -4, 11, CitizenAppointment.Status.COMPLETED, "Renouvellement d'un document"),
            ("DEMO-APT-005", users["citizen5"], users["nandrasana"], "habitat", -2, 15, CitizenAppointment.Status.COMPLETED, "Conseil habitat"),
        ]
        result = {}
        for ref, citizen, agent, service_slug, day_offset, hour, status, reason in rows:
            date = (now + timedelta(days=day_offset)).astimezone()
            starts = date.replace(hour=hour, minute=0, second=0, microsecond=0)
            ends = starts + timedelta(minutes=45)
            obj, _ = CitizenAppointment.objects.update_or_create(
                reference=ref,
                defaults={
                    "citizen": citizen,
                    "agent": agent,
                    "service": self.service(services, service_slug),
                    "starts_at": starts,
                    "ends_at": ends,
                    "reason": reason,
                    "details": "Rendez-vous créé par le seeder de démonstration.",
                    "location": "Hôtel de Ville — Guichet 2",
                    "preparation_instructions": "Présentez votre référence de dossier et une pièce d'identité.",
                    "status": status,
                    "reminder_enabled": True,
                    "reminder_minutes_before": 60,
                },
            )
            result[ref] = obj
        return result

    # ------------------------------------------------------------------
    # Actualités / annonces / alertes publiques — sans image et sans email
    # ------------------------------------------------------------------
    def seed_publications(self, users, services):
        now = self.now
        publications = [
            {
                "slug": "travaux-parc-nova-centre",
                "title": "Le parc urbain Nova Centre entre dans une nouvelle phase",
                "category": "Projets",
                "excerpt": "Les aménagements paysagers commencent cette semaine.",
                "content": "Les travaux du parc urbain progressent. Les cheminements piétons et les premières plantations seront réalisés cette semaine.",
                "publication_type": "news",
                "severity": "info",
                "is_pinned": False,
                "is_important": False,
                "service": self.service(services, "environnement"),
                "author": users["toky"],
                "published_at": now - timedelta(days=2),
            },
            {
                "slug": "horaires-mairie-samedi",
                "title": "Ouverture exceptionnelle de l'accueil municipal samedi",
                "category": "Services municipaux",
                "excerpt": "L'accueil administratif sera ouvert samedi de 8 h à 12 h.",
                "content": "Afin de faciliter les démarches, l'accueil municipal ouvre exceptionnellement samedi matin.",
                "publication_type": "announcement",
                "severity": "info",
                "is_pinned": True,
                "is_important": False,
                "service": self.service(services, "administration"),
                "author": users["toky"],
                "published_at": now - timedelta(hours=8),
            },
            {
                "slug": "vigilance-pluie-nova-sud",
                "title": "Vigilance pluie intense à Nova Sud",
                "category": "Alerte",
                "excerpt": "De fortes pluies sont observées à Nova Sud. Évitez les zones temporairement inondées.",
                "content": "Les services municipaux suivent la situation. Les habitants sont invités à éviter les axes signalés comme inondables.",
                "publication_type": "alert",
                "severity": "warning",
                "is_pinned": True,
                "is_important": True,
                "target_districts": ["Nova Sud"],
                "affected_areas": "Nova Sud — Place du Sud et axes bas",
                "instructions": "Évitez les zones inondées et suivez les consignes des services municipaux.",
                "audience_guidance": ["Habitants de Nova Sud", "Usagers de la voirie"],
                "service": self.service(services, "securite"),
                "author": users["nandrasana"],
                "published_at": now - timedelta(minutes=35),
                "expires_at": now + timedelta(hours=8),
            },
            {
                "slug": "nouveaux-horaires-transport-t1",
                "title": "Nouveaux horaires de la ligne T1",
                "category": "Mobilité",
                "excerpt": "La ligne T1 renforce ses passages aux heures de pointe.",
                "content": "À partir de lundi, la fréquence de la ligne T1 est renforcée le matin et en fin d'après-midi.",
                "publication_type": "news",
                "severity": "info",
                "is_pinned": False,
                "is_important": False,
                "service": self.service(services, "transport"),
                "author": users["nandrasana"],
                "published_at": now - timedelta(days=1),
            },
        ]
        for row in publications:
            slug = row.pop("slug")
            defaults = {
                "is_published": True,
                "notify_residents": False,
                "cover_alt": "",
                "source_name": "Mairie de Nova Terra",
                "target_districts": [],
                "affected_areas": "",
                "instructions": "",
                "audience_guidance": [],
                "expires_at": None,
                "action_label": "",
                "action_url": "",
                **row,
            }
            NewsArticle.objects.update_or_create(slug=slug, defaults=defaults)

    # ------------------------------------------------------------------
    # Participation citoyenne / idées
    # ------------------------------------------------------------------
    def seed_participation(self, users, projects):
        park = projects["parc-urbain-nova-centre"]
        mobility = projects["mobilite-est"]
        ProjectContribution.objects.update_or_create(
            project=park,
            citizen=users["citizen1"],
            contribution_type=ProjectContribution.ContributionType.CONSULTATION,
            defaults={
                "question_snapshot": park.participation_question,
                "choice": "green",
                "choice_label_snapshot": "Plus d'espaces verts",
                "comment": "Préserver des zones ombragées avec des bancs accessibles.",
            },
        )
        ProjectContribution.objects.update_or_create(
            project=mobility,
            citizen=users["citizen2"],
            contribution_type=ProjectContribution.ContributionType.DECISION,
            defaults={
                "question_snapshot": mobility.participation_question,
                "choice": "yes",
                "choice_label_snapshot": "Oui",
                "comment": "Une continuité cyclable serait utile autour des écoles.",
            },
        )
        for citizen_key, project in [
            ("citizen1", park),
            ("citizen3", park),
            ("citizen2", mobility),
            ("citizen4", projects["centre-de-sante-nova-sud"]),
        ]:
            ProjectSupport.objects.get_or_create(project=project, citizen=users[citizen_key])

        ideas = [
            ("DEMO-IDEA-001", users["citizen3"], "Fontaines d'eau dans les espaces publics", "Environnement", "Nova Sud", "Installer quelques points d'eau potable dans les zones très fréquentées."),
            ("DEMO-IDEA-002", users["citizen5"], "Passages piétons mieux éclairés", "Mobilité", "Nova Ouest", "Renforcer l'éclairage à proximité des passages piétons et arrêts de transport."),
        ]
        for reference, citizen, title, category, district, description in ideas:
            MunicipalIdea.objects.update_or_create(
                reference=reference,
                defaults={
                    "citizen": citizen,
                    "title": title,
                    "category": category,
                    "district": district,
                    "description": description,
                    "status": MunicipalIdea.Status.UNDER_REVIEW,
                    "staff_note": "Idée reçue et en cours d'analyse.",
                    "reviewed_by": users["toky"],
                    "reviewed_at": self.now - timedelta(hours=3),
                },
            )

    # ------------------------------------------------------------------
    # Contacts / notifications / avis
    # ------------------------------------------------------------------
    def seed_contacts(self, users, services):
        rows = [
            ("DEMO-CNT-001", users["citizen1"], "Éclairage du quartier", "Je souhaite savoir quand l'intervention est prévue.", "energie", ContactMessage.Status.READ, users["nandrasana"]),
            ("DEMO-CNT-002", users["citizen5"], "Question sur mes données", "Je souhaite comprendre les informations conservées dans mon profil.", "administration", ContactMessage.Status.RECEIVED, users["toky"]),
        ]
        for ref, citizen, subject, message, service_slug, status, assigned in rows:
            ContactMessage.objects.update_or_create(
                reference=ref,
                defaults={
                    "category": ContactMessage.Category.PRIVACY if ref.endswith("002") else ContactMessage.Category.GENERAL,
                    "user": citizen,
                    "name": citizen.get_full_name() or citizen.email,
                    "email": citizen.email,
                    "service": self.service(services, service_slug),
                    "subject": subject,
                    "message": message,
                    "status": status,
                    "assigned_to": assigned,
                    "read_at": self.now - timedelta(hours=1) if status != ContactMessage.Status.RECEIVED else None,
                },
            )

    def seed_notifications(self, users, requests, appointments):
        rows = [
            (users["citizen2"], "demo:req:001:reply", CitizenNotification.Kind.REQUEST, "Document complémentaire demandé", "Un agent vous demande un justificatif de domicile récent.", requests["DEMO-REQ-001"], None, users["toky"], True),
            (users["citizen3"], "demo:rpt:003:reply", CitizenNotification.Kind.REQUEST, "Votre signalement a reçu une réponse", "Une vérification du réseau d'eau est programmée.", requests["DEMO-RPT-003"], None, users["toky"], False),
            (users["citizen1"], "demo:apt:001", CitizenNotification.Kind.APPOINTMENT, "Rendez-vous confirmé", "Votre rendez-vous administratif est confirmé.", None, appointments["DEMO-APT-001"], users["toky"], False),
            (users["citizen3"], "demo:alert:medical", CitizenNotification.Kind.REQUEST, "Signalement urgent enregistré", "Votre signalement urgent a été transmis au circuit prioritaire.", requests["DEMO-RPT-URG-001"], None, users["toky"], True),
        ]
        for user, code, kind, title, message, related_request, related_appointment, sender, important in rows:
            CitizenNotification.objects.update_or_create(
                user=user,
                notification_code=code,
                defaults={
                    "sender": sender,
                    "scope": CitizenNotification.Scope.TARGETED,
                    "kind": kind,
                    "title": title,
                    "message": message,
                    "action_label": "Consulter",
                    "action_url": f"/requests/{related_request.reference}" if related_request else "/appointments",
                    "visible_from": self.now,
                    "is_important": important,
                    "related_request": related_request,
                    "related_appointment": related_appointment,
                    "is_read": False,
                },
            )

    def seed_feedback(self, users, services, requests, appointments):
        ServiceFeedback.objects.update_or_create(
            citizen=users["citizen4"],
            service=self.service(services, "environnement"),
            defaults={
                "source_request": requests["DEMO-RPT-004"],
                "source_appointment": None,
                "rating": 5,
                "comment": "Intervention rapide et suivi clair.",
            },
        )
        ServiceFeedback.objects.update_or_create(
            citizen=users["citizen5"],
            service=self.service(services, "habitat"),
            defaults={
                "source_request": None,
                "source_appointment": appointments["DEMO-APT-005"],
                "rating": 4,
                "comment": "Conseils utiles et rendez-vous bien organisé.",
            },
        )

    # ------------------------------------------------------------------
    # Outbox d'alerting durable
    # ------------------------------------------------------------------
    def seed_alert_dispatches(self, requests):
        pending = requests["DEMO-RPT-URG-001"]
        dispatch, _ = ReportAlertDispatch.objects.get_or_create(
            request=pending,
            defaults={
                "status": ReportAlertDispatch.Status.PENDING,
                "attempts": 0,
                "next_attempt_at": self.now,
                "payload": build_report_alert_payload(pending),
            },
        )
        if dispatch.status == ReportAlertDispatch.Status.CANCELLED:
            dispatch.status = ReportAlertDispatch.Status.PENDING
            dispatch.next_attempt_at = self.now
            dispatch.last_error = ""
            dispatch.payload = build_report_alert_payload(pending)
            dispatch.save(update_fields=["status", "next_attempt_at", "last_error", "payload", "updated_at"])

        acknowledged = requests["DEMO-RPT-URG-002"]
        dispatch2, _ = ReportAlertDispatch.objects.get_or_create(
            request=acknowledged,
            defaults={
                "status": ReportAlertDispatch.Status.DISPATCHED,
                "attempts": 1,
                "next_attempt_at": self.now - timedelta(hours=2),
                "dispatched_at": self.now - timedelta(hours=2),
                "payload": build_report_alert_payload(acknowledged),
            },
        )
        if dispatch2.status != ReportAlertDispatch.Status.DISPATCHED:
            dispatch2.status = ReportAlertDispatch.Status.DISPATCHED
            dispatch2.dispatched_at = dispatch2.dispatched_at or self.now - timedelta(hours=2)
            dispatch2.last_error = ""
            dispatch2.payload = build_report_alert_payload(acknowledged)
            dispatch2.save(update_fields=["status", "dispatched_at", "last_error", "payload", "updated_at"])
