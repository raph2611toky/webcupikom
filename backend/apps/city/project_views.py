from __future__ import annotations

from django.db import IntegrityError, transaction
from django.db.models import Count, Exists, OuterRef, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from helpers.permissions import IsAuthenticatedAdmin, IsAuthenticatedCitizen

from .models import MunicipalIdea, MunicipalProject, ProjectContribution, ProjectSupport
from .project_serializers import (
    AdminMunicipalIdeaSerializer,
    AdminMunicipalProjectSerializer,
    AdminProjectContributionSerializer,
    MunicipalIdeaCitizenSerializer,
    MunicipalProjectPublicSerializer,
    ProjectContributionCreateSerializer,
    ProjectContributionReceiptSerializer,
    ProjectSupportStateSerializer,
)
from .services.audit import record_staff_audit


def _project_public_queryset(request=None):
    queryset = MunicipalProject.objects.filter(is_published=True).annotate(
        support_count=Count("supports", distinct=True)
    )
    user = getattr(request, "user", None)
    if user and user.is_authenticated and getattr(user, "role", None) == "citizen":
        own_support = ProjectSupport.objects.filter(project=OuterRef("pk"), citizen=user)
        queryset = queryset.annotate(is_supported=Exists(own_support))
    return queryset


def _filter_projects(queryset, params):
    project_status = str(params.get("status", "")).strip().lower()
    participation_type = str(params.get("participation_type", "")).strip().lower()
    district = str(params.get("district", "")).strip()
    search = str(params.get("search", "")).strip()

    # Le frontend peut utiliser l'onglet "Consultation" comme pseudo-statut.
    # On le traduit ici sans mélanger l'état d'avancement du projet et son type
    # de participation dans le modèle de données.
    if project_status == "consultation":
        queryset = queryset.filter(participation_type=MunicipalProject.ParticipationType.CONSULTATION)
    elif project_status and project_status != "all":
        valid_statuses = {value for value, _ in MunicipalProject.Status.choices}
        if project_status not in valid_statuses:
            raise ValidationError({"status": "Statut de projet invalide."})
        queryset = queryset.filter(status=project_status)

    if participation_type:
        valid_types = {value for value, _ in MunicipalProject.ParticipationType.choices}
        if participation_type not in valid_types:
            raise ValidationError({"participation_type": "Type de participation invalide."})
        queryset = queryset.filter(participation_type=participation_type)
    if district:
        queryset = queryset.filter(district__iexact=district)
    if search:
        queryset = queryset.filter(
            Q(title__icontains=search)
            | Q(short_description__icontains=search)
            | Q(description__icontains=search)
            | Q(district__icontains=search)
        )
    return queryset


class MunicipalProjectListView(generics.ListAPIView):
    """F67 : liste publique des projets municipaux publiés."""

    permission_classes = [AllowAny]
    serializer_class = MunicipalProjectPublicSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return MunicipalProject.objects.none()
        return _filter_projects(
            _project_public_queryset(self.request), self.request.query_params
        ).order_by("-updated_at", "title")


class MunicipalProjectDetailView(generics.RetrieveAPIView):
    """F67 : fiche publique claire d'un projet municipal."""

    permission_classes = [AllowAny]
    serializer_class = MunicipalProjectPublicSerializer
    lookup_field = "slug"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return MunicipalProject.objects.none()
        return _project_public_queryset(self.request)


class CitizenProjectParticipationView(generics.ListCreateAPIView):
    """F66/F65 : avis non officiel ou décision citoyenne, avec reçu traçable."""

    permission_classes = [IsAuthenticatedCitizen]

    def get_project(self):
        if not hasattr(self, "_project"):
            self._project = get_object_or_404(
                MunicipalProject.objects.filter(is_published=True),
                slug=self.kwargs["slug"],
            )
        return self._project

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ProjectContribution.objects.none()
        project = self.get_project()
        return ProjectContribution.objects.filter(
            project=project, citizen=self.request.user
        ).select_related("project", "citizen")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ProjectContributionCreateSerializer
        return ProjectContributionReceiptSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if not getattr(self, "swagger_fake_view", False):
            context["project"] = self.get_project()
        return context

    def create(self, request, *args, **kwargs):
        project = self.get_project()
        serializer = ProjectContributionCreateSerializer(
            data=request.data,
            context={"request": request, "view": self, "project": project},
        )
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                choice = serializer.validated_data["choice"]
                choice_label = next(
                    (
                        str(option.get("label") or choice)
                        for option in (project.participation_options or [])
                        if isinstance(option, dict) and str(option.get("value")) == choice
                    ),
                    choice,
                )
                contribution = serializer.save(
                    project=project,
                    citizen=request.user,
                    contribution_type=project.participation_type,
                    question_snapshot=project.participation_question,
                    choice_label_snapshot=choice_label,
                )
        except IntegrityError:
            raise ValidationError({
                "project": "Votre participation à cette consultation ou décision est déjà enregistrée."
            })
        output = ProjectContributionReceiptSerializer(
            contribution, context={"request": request}
        )
        return Response(output.data, status=status.HTTP_201_CREATED)


class CitizenProjectSupportView(generics.GenericAPIView):
    """Soutien léger d'un citoyen à un projet, distinct d'un vote F65/F66."""

    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = ProjectSupportStateSerializer

    def get_project(self):
        if not hasattr(self, "_project"):
            self._project = get_object_or_404(
                MunicipalProject.objects.filter(is_published=True),
                slug=self.kwargs["slug"],
            )
        return self._project

    def _state(self, project, support=None, message=""):
        if support is None:
            support = ProjectSupport.objects.filter(
                project=project, citizen=self.request.user
            ).first()
        return {
            "project_slug": project.slug,
            "supported": bool(support),
            "support_count": ProjectSupport.objects.filter(project=project).count(),
            "supported_at": support.created_at if support else None,
            "message": message,
        }

    def get(self, request, *args, **kwargs):
        project = self.get_project()
        return Response(self.get_serializer(self._state(project)).data)

    def post(self, request, *args, **kwargs):
        project = self.get_project()
        if not project.support_enabled:
            raise ValidationError({"project": "Le soutien n'est pas activé pour ce projet."})
        with transaction.atomic():
            support, created = ProjectSupport.objects.get_or_create(
                project=project, citizen=request.user
            )
        payload = self._state(
            project,
            support=support,
            message=(
                "Votre soutien a bien été enregistré."
                if created
                else "Votre soutien était déjà enregistré."
            ),
        )
        return Response(
            self.get_serializer(payload).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, *args, **kwargs):
        project = self.get_project()
        ProjectSupport.objects.filter(project=project, citizen=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CitizenIdeaListCreateView(generics.ListCreateAPIView):
    """F68 : idée générale ou solution liée à un projet municipal."""

    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = MunicipalIdeaCitizenSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return MunicipalIdea.objects.none()
        queryset = MunicipalIdea.objects.filter(citizen=self.request.user).select_related("project")
        project_slug = str(self.request.query_params.get("project", "")).strip()
        if project_slug:
            queryset = queryset.filter(project__slug=project_slug)
        return queryset

    @transaction.atomic
    def perform_create(self, serializer):
        district = serializer.validated_data.get("district") or getattr(
            self.request.user, "district", ""
        )
        serializer.save(citizen=self.request.user, district=district)


class CitizenIdeaDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticatedCitizen]
    serializer_class = MunicipalIdeaCitizenSerializer
    lookup_field = "reference"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return MunicipalIdea.objects.none()
        return MunicipalIdea.objects.filter(citizen=self.request.user).select_related("project")


class AdminProjectListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminMunicipalProjectSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return MunicipalProject.objects.none()
        queryset = MunicipalProject.objects.select_related("created_by").annotate(
            support_count=Count("supports", distinct=True),
            participation_count=Count("contributions", distinct=True),
            idea_count=Count("citizen_ideas", distinct=True),
        )
        return _filter_projects(queryset, self.request.query_params)

    @transaction.atomic
    def perform_create(self, serializer):
        project = serializer.save(created_by=self.request.user)
        record_staff_audit(
            actor=self.request.user,
            action="project.create",
            resource_type="municipal_project",
            resource_id=project.pk,
            resource_reference=project.slug,
            summary="Projet municipal créé",
            changes={
                "status": project.status,
                "participation_type": project.participation_type,
                "is_published": project.is_published,
            },
            request=self.request,
        )


class AdminProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    http_method_names = ["get", "patch", "delete", "head", "options"]
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminMunicipalProjectSerializer
    lookup_field = "slug"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return MunicipalProject.objects.none()
        return MunicipalProject.objects.select_related("created_by").annotate(
            support_count=Count("supports", distinct=True),
            participation_count=Count("contributions", distinct=True),
            idea_count=Count("citizen_ideas", distinct=True),
        )

    @transaction.atomic
    def perform_update(self, serializer):
        instance = serializer.instance
        tracked = (
            "title",
            "short_description",
            "description",
            "district",
            "status",
            "progress",
            "start_date",
            "expected_end_date",
            "actual_end_date",
            "objectives",
            "milestones",
            "participation_type",
            "participation_question",
            "participation_options",
            "participation_opens_at",
            "participation_closes_at",
            "support_enabled",
            "is_published",
        )
        previous = {field: getattr(instance, field) for field in tracked}
        project = serializer.save()
        changed = [field for field in tracked if previous[field] != getattr(project, field)]
        if changed:
            record_staff_audit(
                actor=self.request.user,
                action="project.update",
                resource_type="municipal_project",
                resource_id=project.pk,
                resource_reference=project.slug,
                summary="Projet municipal modifié",
                changes={"fields": changed},
                request=self.request,
            )

    @transaction.atomic
    def perform_destroy(self, instance):
        was_published = instance.is_published
        instance.is_published = False
        instance.save(update_fields=["is_published", "updated_at"])
        record_staff_audit(
            actor=self.request.user,
            action="project.unpublish",
            resource_type="municipal_project",
            resource_id=instance.pk,
            resource_reference=instance.slug,
            summary="Projet municipal retiré de la publication",
            changes={"is_published": {"from": was_published, "to": False}},
            request=self.request,
        )


class AdminProjectContributionListView(generics.ListAPIView):
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminProjectContributionSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ProjectContribution.objects.none()
        queryset = ProjectContribution.objects.select_related("project", "citizen")
        project_slug = str(self.request.query_params.get("project", "")).strip()
        contribution_type = str(self.request.query_params.get("type", "")).strip()
        search = str(self.request.query_params.get("search", "")).strip()
        if project_slug:
            queryset = queryset.filter(project__slug=project_slug)
        if contribution_type:
            valid = {value for value, _ in ProjectContribution.ContributionType.choices}
            if contribution_type not in valid:
                raise ValidationError({"type": "Type de participation invalide."})
            queryset = queryset.filter(contribution_type=contribution_type)
        if search:
            queryset = queryset.filter(
                Q(reference__icontains=search)
                | Q(citizen__email__icontains=search)
                | Q(project__title__icontains=search)
            )
        return queryset


class AdminMunicipalIdeaListView(generics.ListAPIView):
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminMunicipalIdeaSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return MunicipalIdea.objects.none()
        queryset = MunicipalIdea.objects.select_related("project", "citizen", "reviewed_by")
        idea_status = str(self.request.query_params.get("status", "")).strip()
        project_slug = str(self.request.query_params.get("project", "")).strip()
        search = str(self.request.query_params.get("search", "")).strip()
        if idea_status:
            valid = {value for value, _ in MunicipalIdea.Status.choices}
            if idea_status not in valid:
                raise ValidationError({"status": "Statut d'idée invalide."})
            queryset = queryset.filter(status=idea_status)
        if project_slug:
            queryset = queryset.filter(project__slug=project_slug)
        if search:
            queryset = queryset.filter(
                Q(reference__icontains=search)
                | Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(citizen__email__icontains=search)
            )
        return queryset


class AdminMunicipalIdeaDetailView(generics.RetrieveUpdateAPIView):
    http_method_names = ["get", "patch", "head", "options"]
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminMunicipalIdeaSerializer
    lookup_field = "reference"
    queryset = MunicipalIdea.objects.select_related("project", "citizen", "reviewed_by")

    @transaction.atomic
    def perform_update(self, serializer):
        instance = serializer.instance
        previous_status = instance.status
        previous_note = instance.staff_note
        status_changed = "status" in serializer.validated_data and serializer.validated_data["status"] != previous_status
        note_changed = "staff_note" in serializer.validated_data and serializer.validated_data["staff_note"] != previous_note
        extra = {}
        if status_changed:
            extra = {"reviewed_by": self.request.user, "reviewed_at": timezone.now()}
        idea = serializer.save(**extra)
        changed = []
        if status_changed:
            changed.append("status")
        if note_changed:
            changed.append("staff_note")
        if changed:
            record_staff_audit(
                actor=self.request.user,
                action="idea.review",
                resource_type="municipal_idea",
                resource_id=idea.pk,
                resource_reference=idea.reference,
                subject_user=idea.citizen,
                summary="Proposition citoyenne examinée",
                changes={
                    "fields": changed,
                    "status": {"from": previous_status, "to": idea.status},
                },
                request=self.request,
            )
