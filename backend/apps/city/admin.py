from django.contrib import admin
from django import forms
from django.db import transaction
from django.http import FileResponse, Http404
from django.urls import path, reverse
from django.utils.html import format_html
from django.utils import timezone
from django.core.exceptions import ValidationError as DjangoValidationError

from .models import (
    CitizenAppointment,
    CitizenNotification,
    CitizenPreference,
    CitizenRequest,
    CitizenRequestEvent,
    CitizenRequestAttachment,
    ContactMessage,
    MunicipalService,
    NewsArticle,
    StaffAuditEvent,
    WebCupRequestSnapshot,
    WebCupSyncState,
)


@admin.register(MunicipalService)
class MunicipalServiceAdmin(admin.ModelAdmin):
    list_display = (
        "name", "category", "is_featured", "usage_count", "is_active",
        "unavailable_since", "expected_restore_at", "sort_order", "updated_at",
    )
    list_filter = ("category", "is_featured", "is_active")
    search_fields = ("name", "short_description", "description")
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("sort_order", "name")

    def save_model(self, request, obj, form, change):
        previous = None
        if change and obj.pk:
            previous = MunicipalService.objects.filter(pk=obj.pk).values(
                "is_active", "unavailable_since"
            ).first()

        if previous and previous["is_active"] != obj.is_active:
            obj.availability_updated_at = timezone.now()
            if obj.is_active:
                obj.unavailability_reason = ""
                obj.alternative_action = ""
                obj.unavailable_since = None
                obj.expected_restore_at = None
            else:
                obj.unavailability_reason = (
                    obj.unavailability_reason or "Service temporairement indisponible."
                )
                obj.alternative_action = obj.alternative_action or (
                    "Réessayez ultérieurement ou contactez la mairie si votre demande est urgente."
                )
                obj.unavailable_since = previous["unavailable_since"] or timezone.now()

        super().save_model(request, obj, form, change)

        if previous and previous["is_active"] != obj.is_active:
            record_staff_audit(
                actor=request.user,
                action=("service.restore" if obj.is_active else "service.unavailable"),
                resource_type="service",
                resource_id=obj.pk,
                resource_reference=obj.slug,
                summary=(
                    "Service municipal remis en service"
                    if obj.is_active
                    else "Service municipal marqué indisponible"
                ),
                changes={
                    "is_available": {
                        "from": previous["is_active"],
                        "to": obj.is_active,
                    }
                },
                request=request,
            )


class PublicationAdminForm(forms.ModelForm):
    class Meta:
        model = NewsArticle
        exclude = ('cover_image',)

    def clean(self):
        values = super().clean()
        from .news_serializers import PublicationAdminSerializer
        fields = PublicationAdminSerializer().fields
        data = {k: (v.pk if hasattr(v, 'pk') else v) for k, v in values.items() if k in fields and not fields[k].read_only}
        for key in ('target_districts', 'audience_guidance'):
            if data.get(key) is None:
                data[key] = []
        serializer = PublicationAdminSerializer(instance=self.instance if self.instance.pk else None, data=data)
        if not serializer.is_valid():
            raise forms.ValidationError(str(serializer.errors))
        for key in ('target_districts', 'audience_guidance'):
            if key in serializer.validated_data:
                values[key] = serializer.validated_data[key]
        return values


@admin.register(NewsArticle)
class NewsArticleAdmin(admin.ModelAdmin):
    form = PublicationAdminForm
    list_display = ('title', 'publication_type', 'severity', 'is_published', 'published_at', 'expires_at')
    list_filter = ('publication_type', 'severity', 'is_published', 'is_important')
    search_fields = ('title', 'excerpt', 'content', 'affected_areas')
    prepopulated_fields = {'slug': ('title',)}
    ordering = ('-published_at',)
    readonly_fields = ('author', 'delivery_started_at', 'delivery_completed_at')
    exclude = ('cover_image',)

    def save_model(self, request, obj, form, change):
        if not change:
            obj.author = request.user
        super().save_model(request, obj, form, change)


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = (
        "reference", "name", "email", "service", "status", "assigned_to", "created_at"
    )
    list_filter = ("status", "service", "assigned_to")
    search_fields = ("reference", "name", "email", "subject", "message")
    readonly_fields = ("reference", "read_at", "closed_at", "created_at", "updated_at")


class RequestProcessingForm(forms.ModelForm):
    class Meta:
        model = CitizenRequest
        fields = '__all__'

    def clean(self):
        data = super().clean()
        if not self.instance.pk or self.instance.request_type != 'report':
            return data
        from .serializers import AgentCitizenRequestSerializer
        old = CitizenRequest.objects.get(pk=self.instance.pk)
        changes = {}
        for field in ('status', 'priority', 'assigned_to', 'service', 'resolution_summary', 'duplicate_of'):
            if field in data:
                value = data[field]
                changes[field] = value.pk if hasattr(value, 'pk') else value
        serializer = AgentCitizenRequestSerializer(old, data=changes, partial=True, context={'request': self.http_request})
        if not serializer.is_valid():
            raise DjangoValidationError(str(serializer.errors))
        return data


class ReportAttachmentInline(admin.TabularInline):
    model = CitizenRequestAttachment
    extra = 0
    fields = ('secure_file', 'caption', 'is_public', 'uploader', 'created_at')
    readonly_fields = fields

    def secure_file(self, obj):
        if not obj.pk:
            return '—'
        return format_html('<a href="{}" target="_blank" rel="noopener">{}</a>',
            reverse('admin:city_report_image', kwargs={'pk':obj.pk}), obj.original_name)

    secure_file.short_description = 'Photo privée'

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CitizenRequest)
class CitizenRequestAdmin(admin.ModelAdmin):
    form = RequestProcessingForm
    inlines = (ReportAttachmentInline,)
    list_display = ('reference', 'request_type', 'citizen', 'incident_category', 'service', 'status', 'priority', 'assigned_to', 'updated_at')
    list_filter = ('request_type', 'status', 'priority', 'severity', 'incident_category', 'service', 'assigned_to')
    search_fields = ('reference', 'title', 'description', 'district', 'location_text', 'citizen__email')
    readonly_fields = ('reference','created_at','updated_at','routing_source','acknowledged_at','resolved_at','closed_at','reopened_count','cancellation_reason')
    fieldsets = (
        ('Dossier', {'fields': ('reference','citizen','request_type','title','description','incident_category')}),
        ('Localisation', {'fields': ('location_text','district','street','building','landmark','latitude','longitude','location_accuracy')}),
        ('Observation', {'fields': ('occurred_at','frequency','infrastructure_id','severity','danger_present','people_affected','impacts_accessibility','accessibility_details')}),
        ('Contact', {'fields': ('allow_contact','preferred_contact','contact_phone')}),
        ('Traitement', {'fields': ('service','routing_source','assigned_to','status','priority','duplicate_of','resolution_summary')}),
        ('Historique', {'fields': ('acknowledged_at','resolved_at','closed_at','cancellation_reason','reopened_count','created_at','updated_at')}),
    )

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if obj and obj.request_type == 'report':
            fields += ['citizen','request_type','title','description','incident_category','location_text','district','street','building','landmark','latitude','longitude','location_accuracy','occurred_at','frequency','infrastructure_id','severity','danger_present','people_affected','impacts_accessibility','accessibility_details','allow_contact','preferred_contact','contact_phone']
        return fields

    def has_add_permission(self, request):
        # A citizen dossier is created through its validated citizen API.
        return False

    def get_form(self, request, obj=None, **kwargs):
        base = super().get_form(request, obj, **kwargs)
        class RequestBoundForm(base):
            http_request = request
        return RequestBoundForm

    def save_model(self, request, obj, form, change):
        if not change or obj.request_type != 'report':
            return super().save_model(request, obj, form, change)
        from .serializers import AgentCitizenRequestSerializer
        from .services.reports import event, notify_citizen
        with transaction.atomic():
            old = CitizenRequest.objects.select_for_update().get(pk=obj.pk)
            previous = old.status
            fields = ('status','priority','assigned_to','service','resolution_summary','duplicate_of')
            changes = {field: (getattr(obj, field).pk if hasattr(getattr(obj, field), 'pk') else getattr(obj, field)) for field in fields}
            serializer = AgentCitizenRequestSerializer(old, data=changes, partial=True, context={'request':request})
            serializer.is_valid(raise_exception=True)
            saved = serializer.save()
            for field in ('acknowledged_at','resolved_at','closed_at','routing_source'):
                setattr(obj, field, getattr(saved, field))
            # Preserve the form object's values for admin logging and response.
            if previous != saved.status:
                event(saved, request.user, saved.get_status_display(), saved.resolution_summary, kind='status')
                notify_citizen(saved, request.user, saved.resolution_summary or saved.get_status_display(), important=True)
            else:
                event(saved, request.user, 'Traitement mis à jour dans l’administration', public=False)

    def get_urls(self):
        return [path('report-image/<uuid:pk>/', self.admin_site.admin_view(self.report_image), name='city_report_image')] + super().get_urls()

    def report_image(self, request, pk):
        from django.shortcuts import get_object_or_404
        proof = get_object_or_404(CitizenRequestAttachment.objects.select_related('request'), pk=pk)
        if not self.has_view_permission(request, proof.request):
            raise Http404()
        try:
            handle = proof.image.open('rb')
        except FileNotFoundError:
            raise Http404('Image indisponible.')
        response = FileResponse(handle, content_type=proof.content_type)
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response


@admin.register(CitizenRequestEvent)
class CitizenRequestEventAdmin(admin.ModelAdmin):
    list_display = ("request", "event_type", "status", "actor", "is_public", "created_at")
    list_filter = ("event_type", "status", "is_public")
    search_fields = ("request__reference", "title", "message", "actor__email")
    readonly_fields = ("created_at",)


    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CitizenPreference)
class CitizenPreferenceAdmin(admin.ModelAdmin):
    list_display = ("user", "screen_reader_mode", "high_contrast", "font_scale", "onboarding_step", "updated_at")
    list_filter = ("screen_reader_mode", "high_contrast", "onboarding_step")
    search_fields = ("user__email", "user__first_name", "user__last_name")
    readonly_fields = ("updated_at",)


@admin.register(CitizenNotification)
class CitizenNotificationAdmin(admin.ModelAdmin):
    list_display = (
        "user", "kind", "scope", "title", "sender", "is_important",
        "visible_from", "email_sent_at", "is_read", "created_at",
    )
    list_filter = ("kind", "scope", "is_important", "is_read")
    search_fields = ("user__email", "sender__email", "title", "message", "notification_code")
    readonly_fields = ("created_at", "read_at", "email_sent_at", "email_last_error")


@admin.register(CitizenAppointment)
class CitizenAppointmentAdmin(admin.ModelAdmin):
    list_display = (
        "reference", "citizen", "agent", "service", "starts_at", "ends_at", "status",
        "reminder_enabled",
    )
    list_filter = ("status", "service", "agent", "reminder_enabled")
    search_fields = (
        "reference", "reason", "citizen__email", "agent__email", "service__name"
    )
    readonly_fields = ("reference", "created_at", "updated_at")


@admin.register(WebCupRequestSnapshot)
class WebCupRequestSnapshotAdmin(admin.ModelAdmin):
    list_display = (
        "request_code", "requester_name", "difficulty", "xp_available", "wave_number",
        "is_visible", "last_seen_at",
    )
    list_filter = ("difficulty", "wave_number", "group_name", "is_visible", "is_ai_request")
    search_fields = ("request_code", "requester_name", "message_public")
    readonly_fields = ("first_seen_at", "last_seen_at", "raw_payload")


@admin.register(WebCupSyncState)
class WebCupSyncStateAdmin(admin.ModelAdmin):
    list_display = ("key", "api_version", "last_success_at", "updated_at")
    readonly_fields = ("updated_at",)


@admin.register(StaffAuditEvent)
class StaffAuditEventAdmin(admin.ModelAdmin):
    list_display = (
        "created_at", "actor", "actor_role", "action", "resource_type",
        "resource_reference", "visibility",
    )
    list_filter = ("visibility", "actor_role", "resource_type", "action", "created_at")
    search_fields = (
        "actor__email", "actor__first_name", "actor__last_name", "summary",
        "resource_reference", "resource_id",
    )
    readonly_fields = (
        "actor", "actor_role", "action", "resource_type", "resource_id",
        "resource_reference", "subject_user", "summary", "changes", "metadata",
        "visibility", "ip_address", "created_at",
    )
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

# Administration Django du module "Projets municipaux". Les modèles restent
# séparés des demandes citoyennes existantes afin de ne pas mélanger les deux
# flux métiers.
from .models import MunicipalIdea, MunicipalProject, ProjectContribution, ProjectSupport
from .services.audit import record_staff_audit


class ProjectContributionInline(admin.TabularInline):
    model = ProjectContribution
    extra = 0
    fields = ("reference", "citizen", "contribution_type", "question_snapshot", "choice", "choice_label_snapshot", "comment", "created_at")
    readonly_fields = fields
    can_delete = False
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False


class ProjectSupportInline(admin.TabularInline):
    model = ProjectSupport
    extra = 0
    fields = ("citizen", "created_at")
    readonly_fields = fields
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(MunicipalProject)
class MunicipalProjectAdmin(admin.ModelAdmin):
    list_display = (
        "title", "district", "status", "progress", "participation_type",
        "support_enabled", "is_published", "updated_at",
    )
    list_filter = ("status", "participation_type", "support_enabled", "is_published", "district")
    search_fields = ("title", "short_description", "description", "district", "slug")
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ("created_by", "published_at", "created_at", "updated_at")
    inlines = (ProjectContributionInline, ProjectSupportInline)
    fieldsets = (
        ("Projet", {"fields": ("title", "slug", "short_description", "description", "district")}),
        ("Avancement", {"fields": ("status", "progress", "start_date", "expected_end_date", "actual_end_date", "objectives", "milestones")}),
        ("Participation", {"fields": ("participation_type", "participation_question", "participation_options", "participation_opens_at", "participation_closes_at", "support_enabled")}),
        ("Publication", {"fields": ("is_published", "published_at", "created_by", "created_at", "updated_at")}),
    )

    def has_delete_permission(self, request, obj=None):
        # Pour conserver l'historique des participations, on retire un projet
        # de la publication au lieu de le supprimer avec ses traces.
        return False

    def save_model(self, request, obj, form, change):
        if not obj.created_by_id:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
        record_staff_audit(
            actor=request.user,
            action="project.update" if change else "project.create",
            resource_type="municipal_project",
            resource_id=obj.pk,
            resource_reference=obj.slug,
            summary="Projet municipal modifié" if change else "Projet municipal créé",
            changes={"fields": list(form.changed_data)},
            request=request,
        )


@admin.register(ProjectContribution)
class ProjectContributionAdmin(admin.ModelAdmin):
    list_display = ("reference", "project", "citizen", "contribution_type", "choice", "created_at")
    list_filter = ("contribution_type", "project", "created_at")
    search_fields = ("reference", "project__title", "project__slug", "citizen__email", "comment")
    readonly_fields = ("reference", "project", "citizen", "contribution_type", "question_snapshot", "choice", "choice_label_snapshot", "comment", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ProjectSupport)
class ProjectSupportAdmin(admin.ModelAdmin):
    list_display = ("project", "citizen", "created_at")
    list_filter = ("project", "created_at")
    search_fields = ("project__title", "project__slug", "citizen__email")
    readonly_fields = ("project", "citizen", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(MunicipalIdea)
class MunicipalIdeaAdmin(admin.ModelAdmin):
    list_display = ("reference", "title", "citizen", "project", "category", "district", "status", "created_at")
    list_filter = ("status", "category", "district", "project", "created_at")
    search_fields = ("reference", "title", "description", "citizen__email", "project__title")
    readonly_fields = ("reference", "citizen", "project", "title", "category", "district", "description", "created_at", "updated_at")
    fields = (
        "reference", "citizen", "project", "title", "category", "district", "description",
        "status", "staff_note", "reviewed_by", "reviewed_at", "created_at", "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        # La proposition est une trace citoyenne : elle n'est pas supprimée depuis l'admin.
        return False

    def save_model(self, request, obj, form, change):
        review_change = change and ("status" in form.changed_data or "staff_note" in form.changed_data)
        if review_change:
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
        super().save_model(request, obj, form, change)
        if review_change:
            record_staff_audit(
                actor=request.user,
                action="idea.review",
                resource_type="municipal_idea",
                resource_id=obj.pk,
                resource_reference=obj.reference,
                subject_user=obj.citizen,
                summary="Proposition citoyenne examinée",
                changes={"fields": list(form.changed_data)},
                request=request,
            )
