from django.urls import path

from .views import (
    AgentRegisterView,
    ChangeEmailConfirmView,
    ChangeEmailRequestView,
    ChangePasswordView,
    DeleteAccountView,
    GoogleLoginView,
    GoogleRedirectView,
    LoginView,
    LogoutView,
    MFAConfirmView,
    MFADisableView,
    MFARecoveryCodesRegenerateView,
    MFASetupView,
    MFAStatusView,
    MFAVerifyLoginView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    ProfileView,
    RefreshView,
    RegisterView,
    RegistrationProfileView,
    ResendVerificationView,
    SetPasswordView,
    VerifyEmailView,
)

app_name = "users"

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/register/profile/", RegistrationProfileView.as_view(), name="register-profile"),
    path("auth/register/agent/", AgentRegisterView.as_view(), name="register-agent"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/google/redirect/", GoogleRedirectView.as_view(), name="google-redirect"),
    path("auth/google/", GoogleLoginView.as_view(), name="google-login"),
    path("auth/mfa/verify/", MFAVerifyLoginView.as_view(), name="mfa-verify-login"),
    path("auth/refresh/", RefreshView.as_view(), name="refresh"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/verify-email/", VerifyEmailView.as_view(), name="verify-email"),
    path("auth/resend-verification/", ResendVerificationView.as_view(), name="resend-verification"),
    path("auth/password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("account/profile/", ProfileView.as_view(), name="profile"),
    path("account/mfa/", MFAStatusView.as_view(), name="mfa-status"),
    path("account/mfa/setup/", MFASetupView.as_view(), name="mfa-setup"),
    path("account/mfa/confirm/", MFAConfirmView.as_view(), name="mfa-confirm"),
    path("account/mfa/disable/", MFADisableView.as_view(), name="mfa-disable"),
    path("account/mfa/recovery-codes/regenerate/", MFARecoveryCodesRegenerateView.as_view(), name="mfa-recovery-regenerate"),
    path("account/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("account/set-password/", SetPasswordView.as_view(), name="set-password"),
    path("account/change-email/", ChangeEmailRequestView.as_view(), name="change-email"),
    path("account/change-email/confirm/", ChangeEmailConfirmView.as_view(), name="change-email-confirm"),
    path("account/", DeleteAccountView.as_view(), name="delete-account"),
]

from .security_views import (
    MFALoginEmailSendView, MFASensitiveEmailSendView, SessionListView,
    SessionRevokeRequestView, SessionRevokeConfirmView, CurrentSessionLogoutView, CSRFTokenView,
)
urlpatterns += [
    path('auth/csrf/', CSRFTokenView.as_view(), name='csrf'),
    path('auth/mfa/email/send/', MFALoginEmailSendView.as_view(), name='mfa-email-send'),
    path('account/mfa/email/send/', MFASensitiveEmailSendView.as_view(), name='mfa-sensitive-email-send'),
    path('account/sessions/', SessionListView.as_view(), name='sessions'),
    path('account/sessions/revoke/request/', SessionRevokeRequestView.as_view(), name='session-revoke-request'),
    path('account/sessions/revoke/confirm/', SessionRevokeConfirmView.as_view(), name='session-revoke-confirm'),
    path('account/sessions/current/logout/', CurrentSessionLogoutView.as_view(), name='session-current-logout'),
]

from .security_views import AgentCitizenListView, AgentCitizenDetailView, SecurityEventListView
urlpatterns += [
    path('agent/citizens/', AgentCitizenListView.as_view(), name='agent-citizens'),
    path('agent/citizens/<int:pk>/', AgentCitizenDetailView.as_view(), name='agent-citizen'),
    path('account/security/events/', SecurityEventListView.as_view(), name='security-events'),
]
