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
        "is_active",
        "is_staff",
        "date_joined",
    )
    list_filter = ("role", "auth_provider", "email_verified", "is_active", "is_staff", "is_superuser")
    search_fields = ("email", "first_name", "last_name", "phone_number")
    ordering = ("-date_joined",)
    readonly_fields = ("last_login", "date_joined", "updated_at")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profil", {"fields": ("first_name", "last_name", "role", "phone_number", "avatar", "avatar_url", "locale")}),
        ("Authentification", {"fields": ("auth_provider", "google_sub", "email_verified")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined", "updated_at")}),
    )
    add_fieldsets = (
        (None, {
            "fields": ("email", "first_name", "last_name", "role", "password1", "password2", "is_staff", "is_active"),
        }),
    )

    @admin.display(description="Nom")
    def display_name(self, obj):
        return obj.get_full_name().strip() or "—"


admin.site.site_header = "Administration"
admin.site.site_title = "Administration"
admin.site.index_title = "Tableau de bord"
