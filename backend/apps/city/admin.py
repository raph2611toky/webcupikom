from django.contrib import admin

from .models import (
    CitizenNotification,
    CitizenRequest,
    ContactMessage,
    MunicipalService,
    NewsArticle,
    WebCupRequestSnapshot,
    WebCupSyncState,
)


@admin.register(MunicipalService)
class MunicipalServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "is_active", "sort_order", "updated_at")
    list_filter = ("category", "is_active")
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


@admin.register(CitizenNotification)
class CitizenNotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "kind", "title", "is_read", "created_at")
    list_filter = ("kind", "is_read")
    search_fields = ("user__email", "title", "message")
    readonly_fields = ("created_at", "read_at")


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
