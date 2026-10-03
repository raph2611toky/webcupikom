from django.contrib import admin
from django import forms
from django.db import transaction
from django.http import FileResponse, Http404
from django.urls import path, reverse
from django.utils.html import format_html
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
    list_display = ("name", "category", "is_featured", "usage_count", "is_active", "sort_order", "updated_at")
    list_filter = ("category", "is_featured", "is_active")
    search_fields = ("name", "short_description", "description")
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("sort_order", "name")


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
