from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User

from .models import (
    MunicipalIdea,
    MunicipalProject,
    ProjectContribution,
    ProjectSupport,
    StaffAuditEvent,
)


class MunicipalProjectApiTests(APITestCase):
    def setUp(self):
        self.citizen = User.objects.create_user(
            email="project-citizen@example.com",
            password="StrongPass123!",
            role=User.Role.CITIZEN,
            email_verified=True,
            is_active=True,
            district="Nova Centre",
        )
        self.other_citizen = User.objects.create_user(
            email="project-other@example.com",
            password="StrongPass123!",
            role=User.Role.CITIZEN,
            email_verified=True,
            is_active=True,
        )
        self.agent = User.objects.create_user(
            email="project-agent@example.com",
            password="StrongPass123!",
            role=User.Role.AGENT,
            email_verified=True,
            is_active=True,
        )
        self.admin = User.objects.create_user(
            email="project-admin@example.com",
            password="StrongPass123!",
            role=User.Role.ADMIN,
            email_verified=True,
            is_active=True,
        )
        now = timezone.now()
        self.project = MunicipalProject.objects.create(
            title="Parc urbain Nova Centre",
            slug="parc-urbain-nova-centre",
            short_description="Création d'un nouvel espace vert.",
            description="Réaménagement du quartier central.",
            district="Nova Centre",
            status=MunicipalProject.Status.IN_PROGRESS,
            progress=70,
            objectives=["Créer un espace vert", "Améliorer les déplacements piétons"],
            milestones=[
                {"title": "Étude", "status": "completed"},
                {"title": "Espaces verts", "status": "current"},
            ],
            participation_type=MunicipalProject.ParticipationType.CONSULTATION,
            participation_question="Que pensez-vous de ce projet ?",
            participation_options=[
                {"value": "favorable", "label": "Favorable"},
                {"value": "neutral", "label": "Neutre"},
                {"value": "unfavorable", "label": "Défavorable"},
            ],
            participation_opens_at=now - timedelta(hours=1),
            participation_closes_at=now + timedelta(days=5),
            support_enabled=True,
            is_published=True,
            created_by=self.admin,
        )
        self.hidden_project = MunicipalProject.objects.create(
            title="Projet interne",
            slug="projet-interne",
            description="Projet non publié",
            status=MunicipalProject.Status.PLANNED,
            is_published=False,
            created_by=self.admin,
        )

    def test_public_project_list_only_exposes_published_projects(self):
        response = self.client.get(reverse("city:project-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = {item["slug"] for item in response.data}
        self.assertIn(self.project.slug, slugs)
        self.assertNotIn(self.hidden_project.slug, slugs)

    def test_consultation_creates_traceable_receipt_and_rejects_duplicate(self):
        self.client.force_authenticate(self.citizen)
        url = reverse("city:citizen-project-participation", kwargs={"slug": self.project.slug})
        response = self.client.post(
            url,
            {"choice": "favorable", "comment": "Le projet me paraît utile."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["reference"].startswith("NT-PART-"))
        self.assertEqual(response.data["contribution_type"], "consultation")
        self.assertEqual(response.data["question_snapshot"], self.project.participation_question)
        self.assertEqual(response.data["choice_label"], "Favorable")
        self.assertIn("confirmation", response.data)
        self.assertEqual(ProjectContribution.objects.filter(citizen=self.citizen).count(), 1)

        duplicate = self.client.post(url, {"choice": "neutral"}, format="json")
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ProjectContribution.objects.filter(citizen=self.citizen).count(), 1)

    def test_decision_uses_same_endpoint_but_keeps_decision_type(self):
        self.project.participation_type = MunicipalProject.ParticipationType.DECISION
        self.project.participation_question = "Faut-il ajouter une piste cyclable ?"
        self.project.participation_options = [
            {"value": "yes", "label": "Oui"},
            {"value": "no", "label": "Non"},
            {"value": "no_opinion", "label": "Sans avis"},
        ]
        self.project.save()

        self.client.force_authenticate(self.citizen)
        response = self.client.post(
            reverse("city:citizen-project-participation", kwargs={"slug": self.project.slug}),
            {"choice": "yes"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["contribution_type"], "decision")

    def test_closed_participation_is_rejected(self):
        self.project.participation_closes_at = timezone.now() - timedelta(seconds=1)
        self.project.save()
        self.client.force_authenticate(self.citizen)
        response = self.client.post(
            reverse("city:citizen-project-participation", kwargs={"slug": self.project.slug}),
            {"choice": "favorable"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(ProjectContribution.objects.filter(citizen=self.citizen).exists())

    def test_project_support_is_idempotent_and_removable(self):
        self.client.force_authenticate(self.citizen)
        url = reverse("city:citizen-project-support", kwargs={"slug": self.project.slug})

        first = self.client.post(url, {}, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertTrue(first.data["supported"])
        self.assertEqual(first.data["support_count"], 1)

        second = self.client.post(url, {}, format="json")
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(ProjectSupport.objects.filter(project=self.project).count(), 1)

        removed = self.client.delete(url)
        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ProjectSupport.objects.filter(project=self.project, citizen=self.citizen).exists())

    def test_citizen_can_submit_city_idea_or_project_solution_with_reference(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.post(
            reverse("city:citizen-idea-list"),
            {
                "project_slug": self.project.slug,
                "title": "Ajouter des bancs accessibles",
                "category": "Aménagement",
                "description": "Installer plusieurs bancs accessibles près des chemins principaux.",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["reference"].startswith("IDEA-"))
        self.assertEqual(response.data["kind"], "project_solution")
        idea = MunicipalIdea.objects.get(reference=response.data["reference"])
        self.assertEqual(idea.citizen, self.citizen)
        self.assertEqual(idea.project, self.project)
        self.assertEqual(idea.district, self.citizen.district)

    def test_citizen_cannot_read_another_citizens_idea(self):
        idea = MunicipalIdea.objects.create(
            citizen=self.other_citizen,
            title="Autre idée",
            category="Mobilité",
            description="Une proposition suffisamment longue.",
        )
        self.client.force_authenticate(self.citizen)
        response = self.client.get(
            reverse("city:citizen-idea-detail", kwargs={"reference": idea.reference})
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_can_create_project_and_action_is_audited(self):
        self.client.force_authenticate(self.agent)
        denied = self.client.post(
            reverse("city:admin-project-list"),
            {"title": "Projet agent", "description": "Ne doit pas être créé."},
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse("city:admin-project-list"),
            {
                "title": "Mobilité Est",
                "description": "Amélioration des déplacements à l'est.",
                "status": "planned",
                "participation_type": "consultation",
                "is_published": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["slug"].startswith("mobilite-est"))
        self.assertEqual(len(response.data["participation_options"]), 4)
        self.assertTrue(
            StaffAuditEvent.objects.filter(
                actor=self.admin,
                action="project.create",
                resource_reference=response.data["slug"],
            ).exists()
        )

    def test_admin_can_review_idea_without_changing_citizen_payload(self):
        idea = MunicipalIdea.objects.create(
            citizen=self.citizen,
            project=self.project,
            title="Ajouter une fontaine",
            category="Aménagement",
            description="Ajouter une fontaine d'eau dans le nouveau parc.",
        )
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            reverse("city:admin-idea-detail", kwargs={"reference": idea.reference}),
            {"status": "under_review", "staff_note": "Analyse technique en cours."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        idea.refresh_from_db()
        self.assertEqual(idea.status, MunicipalIdea.Status.UNDER_REVIEW)
        self.assertEqual(idea.reviewed_by, self.admin)
        self.assertTrue(
            StaffAuditEvent.objects.filter(
                actor=self.admin,
                action="idea.review",
                resource_reference=idea.reference,
            ).exists()
        )
