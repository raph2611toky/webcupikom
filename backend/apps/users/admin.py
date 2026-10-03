from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .forms import AdminUserChangeForm, AdminUserCreationForm
from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    add_form = AdminUserCreationForm
    form = AdminUserChangeForm
    model = User

    list_display = (
        "email",
        "display_name",
        "role",
        "auth_provider",
        "email_verified",
        "mfa_enabled",
        "is_active",
        "is_staff",
        "date_joined",
    )
    list_filter = ("role", "auth_provider", "email_verified", "mfa_enabled", "is_active", "is_staff", "is_superuser")
    search_fields = ("email", "first_name", "last_name", "phone_number")
    ordering = ("-date_joined",)
    readonly_fields = ("mfa_enabled", "mfa_confirmed_at", "auth_token_version", "last_login", "date_joined", "updated_at")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profil", {"fields": ("first_name", "last_name", "role", "phone_number", "avatar", "avatar_url", "locale")}),
        ("Authentification", {"fields": ("auth_provider", "google_sub", "email_verified", "mfa_enabled", "mfa_confirmed_at")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined", "updated_at")}),
    )
    add_fieldsets = (
        (None, {
            "fields": ("email", "first_name", "last_name", "role", "password1", "password2", "is_staff", "is_active"),
        }),
    )

    def save_model(self, request, obj, form, change):
        from django.db import transaction
        from .services.sessions import revoke_all
        with transaction.atomic():
            previous = User.objects.select_for_update().get(pk=obj.pk) if change else None
            fields = ('is_active', 'role', 'email', 'email_verified', 'password')
            security_change = previous and any(getattr(previous, f) != getattr(obj, f) for f in fields)
            super().save_model(request, obj, form, change)
            if security_change:
                revoke_all(obj, 'django_admin_change')

    @admin.display(description="Nom")
    def display_name(self, obj):
        return obj.get_full_name().strip() or "—"


admin.site.site_header = "Administration"
admin.site.site_title = "Administration"
admin.site.index_title = "Tableau de bord"


from .models import AccountSession, SecurityEvent


class SecurityReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AccountSession)
class AccountSessionAdmin(SecurityReadOnlyAdmin):
    list_display = ('id', 'user', 'created_at', 'last_seen_at', 'expires_at', 'revoked_at')
    list_filter = ('revoked_at',)
    exclude = ('refresh_jti',)
    search_fields = ('user__email',)


@admin.register(SecurityEvent)
class SecurityEventAdmin(SecurityReadOnlyAdmin):
    list_display = ('kind', 'actor', 'subject', 'created_at')
    list_filter = ('kind',)
    search_fields = ('subject__email', 'actor__email')
