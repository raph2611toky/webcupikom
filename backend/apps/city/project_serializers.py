from __future__ import annotations

from django.utils.text import slugify
from rest_framework import serializers

from .models import MunicipalIdea, MunicipalProject, ProjectContribution, ProjectSupport


DEFAULT_CONSULTATION_OPTIONS = [
    {"value": "very_favorable", "label": "Très favorable"},
    {"value": "favorable", "label": "Favorable"},
    {"value": "neutral", "label": "Neutre"},
    {"value": "unfavorable", "label": "Défavorable"},
]
MILESTONE_STATUSES = {"completed", "current", "pending"}


def _normalize_string_list(value, field_name):
    if value in (None, ""):
        return []
    if not isinstance(value, list):
        raise serializers.ValidationError({field_name: "Une liste est attendue."})
    cleaned = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise serializers.ValidationError({field_name: "Chaque élément doit être un texte non vide."})
        cleaned.append(item.strip())
    return cleaned


def _normalize_milestones(value):
    if value in (None, ""):
        return []
    if not isinstance(value, list):
        raise serializers.ValidationError({"milestones": "Une liste est attendue."})
    cleaned = []
    for position, item in enumerate(value):
        if not isinstance(item, dict):
            raise serializers.ValidationError({"milestones": f"L'étape {position + 1} doit être un objet."})
        title = str(item.get("title", "")).strip()
        state = str(item.get("status", "pending")).strip().lower()
        if not title:
            raise serializers.ValidationError({"milestones": f"L'étape {position + 1} doit avoir un titre."})
        if state not in MILESTONE_STATUSES:
            raise serializers.ValidationError({
                "milestones": (
                    f"Statut invalide pour l'étape {position + 1}. "
                    "Valeurs : completed, current, pending."
                )
            })
        row = dict(item)
        row["title"] = title
        row["status"] = state
        cleaned.append(row)
    return cleaned


def _normalize_participation_options(value):
    if value in (None, ""):
        return []
    if not isinstance(value, list):
        raise serializers.ValidationError({"participation_options": "Une liste est attendue."})
    cleaned = []
    values = set()
    for position, item in enumerate(value):
        if not isinstance(item, dict):
            raise serializers.ValidationError({
                "participation_options": f"Le choix {position + 1} doit être un objet."
            })
        option_value = str(item.get("value", "")).strip()
        label = str(item.get("label", "")).strip()
        if not option_value or not label:
            raise serializers.ValidationError({
                "participation_options": "Chaque choix doit contenir value et label."
            })
        if len(option_value) > 80:
            raise serializers.ValidationError({
                "participation_options": "La valeur d'un choix ne peut pas dépasser 80 caractères."
            })
        if len(label) > 160:
            raise serializers.ValidationError({
                "participation_options": "Le libellé d'un choix ne peut pas dépasser 160 caractères."
            })
        if option_value in values:
            raise serializers.ValidationError({
                "participation_options": f"La valeur '{option_value}' est dupliquée."
            })
        values.add(option_value)
        cleaned.append({"value": option_value, "label": label})
    return cleaned


def _unique_project_slug(title):
    base = slugify(title)[:220] or "projet-municipal"
    candidate = base
    index = 2
    while MunicipalProject.objects.filter(slug=candidate).exists():
        suffix = f"-{index}"
        candidate = f"{base[:240-len(suffix)]}{suffix}"
        index += 1
    return candidate


class MunicipalProjectPublicSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    participation_type_label = serializers.CharField(
        source="get_participation_type_display", read_only=True
    )
    participation_is_open = serializers.BooleanField(read_only=True)
    support_count = serializers.SerializerMethodField()
    is_supported = serializers.SerializerMethodField()

    class Meta:
        model = MunicipalProject
        fields = (
            "id",
            "slug",
            "title",
            "short_description",
            "description",
            "district",
            "status",
            "status_label",
            "progress",
            "start_date",
            "expected_end_date",
            "actual_end_date",
            "objectives",
            "milestones",
            "participation_type",
            "participation_type_label",
            "participation_question",
            "participation_options",
            "participation_opens_at",
            "participation_closes_at",
            "participation_is_open",
            "support_enabled",
            "support_count",
            "is_supported",
            "published_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_support_count(self, obj):
        value = getattr(obj, "support_count", None)
        return int(value if value is not None else obj.supports.count())

    def get_is_supported(self, obj):
        annotated = getattr(obj, "is_supported", None)
        if annotated is not None:
            return bool(annotated)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or getattr(user, "role", None) != "citizen":
            return False
        return obj.supports.filter(citizen=user).exists()


class AdminMunicipalProjectSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    participation_type_label = serializers.CharField(
        source="get_participation_type_display", read_only=True
    )
    participation_is_open = serializers.BooleanField(read_only=True)
    support_count = serializers.SerializerMethodField()
    participation_count = serializers.SerializerMethodField()
    idea_count = serializers.SerializerMethodField()
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = MunicipalProject
        fields = (
            "id",
            "slug",
            "title",
            "short_description",
            "description",
            "district",
            "status",
            "status_label",
            "progress",
            "start_date",
            "expected_end_date",
            "actual_end_date",
            "objectives",
            "milestones",
            "participation_type",
            "participation_type_label",
            "participation_question",
            "participation_options",
            "participation_opens_at",
            "participation_closes_at",
            "participation_is_open",
            "support_enabled",
            "is_published",
            "published_at",
            "support_count",
            "participation_count",
            "idea_count",
            "created_by_email",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "status_label",
            "participation_type_label",
            "participation_is_open",
            "published_at",
            "support_count",
            "participation_count",
            "idea_count",
            "created_by_email",
            "created_at",
            "updated_at",
        )
        extra_kwargs = {"slug": {"required": False, "allow_blank": True}}

    def get_support_count(self, obj):
        value = getattr(obj, "support_count", None)
        return int(value if value is not None else obj.supports.count())

    def get_participation_count(self, obj):
        value = getattr(obj, "participation_count", None)
        return int(value if value is not None else obj.contributions.count())

    def get_idea_count(self, obj):
        value = getattr(obj, "idea_count", None)
        return int(value if value is not None else obj.citizen_ideas.count())

    def validate(self, attrs):
        attrs = dict(attrs)
        instance = self.instance

        if "objectives" in attrs:
            attrs["objectives"] = _normalize_string_list(attrs["objectives"], "objectives")
        if "milestones" in attrs:
            attrs["milestones"] = _normalize_milestones(attrs["milestones"])
        if "participation_options" in attrs:
            attrs["participation_options"] = _normalize_participation_options(
                attrs["participation_options"]
            )

        ptype = attrs.get(
            "participation_type",
            getattr(instance, "participation_type", MunicipalProject.ParticipationType.NONE),
        )
        options = attrs.get("participation_options", getattr(instance, "participation_options", []))
        question = attrs.get(
            "participation_question", getattr(instance, "participation_question", "")
        )

        if ptype == MunicipalProject.ParticipationType.CONSULTATION and not options:
            attrs["participation_options"] = list(DEFAULT_CONSULTATION_OPTIONS)
            options = attrs["participation_options"]
        if ptype == MunicipalProject.ParticipationType.DECISION:
            if not str(question or "").strip():
                raise serializers.ValidationError({
                    "participation_question": "Une question est requise pour une décision citoyenne."
                })
            if len(options or []) < 2:
                raise serializers.ValidationError({
                    "participation_options": "Au moins deux choix sont requis pour une décision citoyenne."
                })
        elif ptype == MunicipalProject.ParticipationType.CONSULTATION and len(options or []) < 2:
            raise serializers.ValidationError({
                "participation_options": "Au moins deux choix sont requis pour une consultation."
            })

        start_date = attrs.get("start_date", getattr(instance, "start_date", None))
        expected_end = attrs.get(
            "expected_end_date", getattr(instance, "expected_end_date", None)
        )
        if start_date and expected_end and expected_end < start_date:
            raise serializers.ValidationError({
                "expected_end_date": "La date de fin estimée doit être postérieure au début."
            })

        opens_at = attrs.get(
            "participation_opens_at", getattr(instance, "participation_opens_at", None)
        )
        closes_at = attrs.get(
            "participation_closes_at", getattr(instance, "participation_closes_at", None)
        )
        if opens_at and closes_at and closes_at <= opens_at:
            raise serializers.ValidationError({
                "participation_closes_at": "La clôture doit être postérieure à l'ouverture."
            })
        return attrs

    def create(self, validated_data):
        if not validated_data.get("slug"):
            validated_data["slug"] = _unique_project_slug(validated_data.get("title", ""))
        return super().create(validated_data)


class ProjectContributionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectContribution
        fields = ("choice", "comment")
        extra_kwargs = {
            "choice": {"required": True},
            "comment": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        project = self.context.get("project")
        request = self.context.get("request")
        if not project:
            raise serializers.ValidationError("Projet introuvable.")
        if not project.participation_is_open:
            raise serializers.ValidationError({
                "project": "La participation à ce projet n'est pas ouverte."
            })
        allowed = {
            str(item.get("value"))
            for item in (project.participation_options or [])
            if isinstance(item, dict) and item.get("value") is not None
        }
        choice = str(attrs.get("choice", "")).strip()
        if choice not in allowed:
            raise serializers.ValidationError({
                "choice": "Choix invalide pour cette consultation ou décision."
            })
        attrs["choice"] = choice
        attrs["comment"] = str(attrs.get("comment", "")).strip()

        user = getattr(request, "user", None)
        if user and user.is_authenticated and ProjectContribution.objects.filter(
            project=project,
            citizen=user,
            contribution_type=project.participation_type,
        ).exists():
            raise serializers.ValidationError({
                "project": "Votre participation à cette consultation ou décision est déjà enregistrée."
            })
        return attrs


class ProjectContributionReceiptSerializer(serializers.ModelSerializer):
    project_slug = serializers.CharField(source="project.slug", read_only=True)
    project_title = serializers.CharField(source="project.title", read_only=True)
    contribution_type_label = serializers.CharField(
        source="get_contribution_type_display", read_only=True
    )
    choice_label = serializers.SerializerMethodField()
    confirmation = serializers.SerializerMethodField()

    class Meta:
        model = ProjectContribution
        fields = (
            "reference",
            "project_slug",
            "project_title",
            "contribution_type",
            "contribution_type_label",
            "question_snapshot",
            "choice",
            "choice_label",
            "comment",
            "created_at",
            "confirmation",
        )
        read_only_fields = fields

    def get_choice_label(self, obj):
        if obj.choice_label_snapshot:
            return obj.choice_label_snapshot
        for option in obj.project.participation_options or []:
            if isinstance(option, dict) and str(option.get("value")) == obj.choice:
                return option.get("label") or obj.choice
        return obj.choice

    def get_confirmation(self, obj):
        return f"Votre participation a bien été enregistrée le {obj.created_at.isoformat()}."


class ProjectSupportStateSerializer(serializers.Serializer):
    project_slug = serializers.CharField(read_only=True)
    supported = serializers.BooleanField(read_only=True)
    support_count = serializers.IntegerField(read_only=True)
    supported_at = serializers.DateTimeField(read_only=True, allow_null=True)
    message = serializers.CharField(read_only=True)


class MunicipalIdeaCitizenSerializer(serializers.ModelSerializer):
    project_slug = serializers.SlugRelatedField(
        source="project",
        slug_field="slug",
        queryset=MunicipalProject.objects.filter(is_published=True),
        required=False,
        allow_null=True,
    )
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    kind = serializers.SerializerMethodField()
    confirmation = serializers.SerializerMethodField()

    class Meta:
        model = MunicipalIdea
        fields = (
            "reference",
            "project_slug",
            "kind",
            "title",
            "category",
            "district",
            "description",
            "status",
            "status_label",
            "created_at",
            "updated_at",
            "confirmation",
        )
        read_only_fields = (
            "reference",
            "kind",
            "status",
            "status_label",
            "created_at",
            "updated_at",
            "confirmation",
        )

    def get_kind(self, obj):
        return "project_solution" if obj.project_id else "city_idea"

    def get_confirmation(self, obj):
        return f"Proposition envoyée. Référence : {obj.reference}."

    def validate_title(self, value):
        value = str(value).strip()
        if len(value) < 3:
            raise serializers.ValidationError("Le titre doit contenir au moins 3 caractères.")
        return value

    def validate_category(self, value):
        value = str(value).strip()
        if not value:
            raise serializers.ValidationError("La catégorie est requise.")
        return value

    def validate_description(self, value):
        value = str(value).strip()
        if len(value) < 10:
            raise serializers.ValidationError("La proposition doit contenir au moins 10 caractères.")
        return value


class AdminProjectContributionSerializer(ProjectContributionReceiptSerializer):
    citizen_id = serializers.IntegerField(source="citizen.id", read_only=True)
    citizen_email = serializers.EmailField(source="citizen.email", read_only=True)
    citizen_name = serializers.SerializerMethodField()

    class Meta(ProjectContributionReceiptSerializer.Meta):
        fields = ProjectContributionReceiptSerializer.Meta.fields + (
            "citizen_id",
            "citizen_email",
            "citizen_name",
        )

    def get_citizen_name(self, obj):
        return obj.citizen.get_full_name().strip()


class AdminMunicipalIdeaSerializer(serializers.ModelSerializer):
    project_slug = serializers.CharField(source="project.slug", read_only=True, allow_null=True)
    project_title = serializers.CharField(source="project.title", read_only=True, allow_null=True)
    citizen_id = serializers.IntegerField(source="citizen.id", read_only=True)
    citizen_email = serializers.EmailField(source="citizen.email", read_only=True)
    citizen_name = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    reviewed_by_email = serializers.EmailField(source="reviewed_by.email", read_only=True, allow_null=True)

    class Meta:
        model = MunicipalIdea
        fields = (
            "reference",
            "project_slug",
            "project_title",
            "citizen_id",
            "citizen_email",
            "citizen_name",
            "title",
            "category",
            "district",
            "description",
            "status",
            "status_label",
            "staff_note",
            "reviewed_by_email",
            "reviewed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "reference",
            "project_slug",
            "project_title",
            "citizen_id",
            "citizen_email",
            "citizen_name",
            "title",
            "category",
            "district",
            "description",
            "status_label",
            "reviewed_by_email",
            "reviewed_at",
            "created_at",
            "updated_at",
        )

    def get_citizen_name(self, obj):
        return obj.citizen.get_full_name().strip()
