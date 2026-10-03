from django.contrib import admin

from .models import (
    CitizenAppointment,
    CitizenNotification,
    CitizenPreference,
    CitizenRequest,
    CitizenRequestEvent,
    ContactMessage,
    MunicipalService,
    NewsArticle,
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


@admin.register(NewsArticle)
class NewsArticleAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "is_published", "published_at")
    list_filter = ("category", "is_published")
    search_fields = ("title", "excerpt", "content")
    prepopulated_fields = {"slug": ("title",)}
    ordering = ("-published_at",)


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = (
        "reference", "name", "email", "service", "status", "assigned_to", "created_at"
    )
    list_filter = ("status", "service", "assigned_to")
    search_fields = ("reference", "name", "email", "subject", "message")
    readonly_fields = ("reference", "read_at", "closed_at", "created_at", "updated_at")


@admin.register(CitizenRequest)
class CitizenRequestAdmin(admin.ModelAdmin):
    list_display = (
        "reference", "citizen", "service", "status", "priority", "assigned_to", "updated_at"
    )
    list_filter = ("status", "priority", "service", "assigned_to")
    search_fields = ("reference", "title", "description", "citizen__email")
    readonly_fields = ("reference", "created_at", "updated_at")


@admin.register(CitizenRequestEvent)
class CitizenRequestEventAdmin(admin.ModelAdmin):
    list_display = ("request", "event_type", "status", "actor", "is_public", "created_at")
    list_filter = ("event_type", "status", "is_public")
    search_fields = ("request__reference", "title", "message", "actor__email")
    readonly_fields = ("created_at",)


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
