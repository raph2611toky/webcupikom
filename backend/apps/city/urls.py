from .news_views import ActiveAlertListView, NewsCoverView, AdminNewsCoverView, AdminNewsDeliveryView
from django.urls import path

from .views import (
    AdminAppointmentDetailView,
    AdminAppointmentListView,
    AdminAuditDetailView,
    AdminAuditListView,
    AdminContactMessageDetailView,
    AdminContactMessageListView,
    AdminDashboardView,
    AdminNewsDetailView,
    AdminNewsListCreateView,
    AdminNotificationCreateView,
    AdminReportAlertAcknowledgeView,
    AdminReportAlertListView,
    AdminRequestDetailView,
    AdminRequestListView,
    AdminRequestSimilarView,
    AdminRequestSummaryView,
    AdminRequestTimelineView,
    AdminServiceDetailView,
    AdminServiceListCreateView,
    ServiceAvailabilityView,
    AdminSystemView,
    AdminUserDetailView,
    AdminUserListCreateView,
    AgentAssigneeListView,
    AgentAppointmentDetailView,
    AgentAuditDetailView,
    AgentAuditListView,
    AgentAppointmentListView,
    AgentContactMessageDetailView,
    AgentContactMessageListView,
    AgentDashboardView,
    AgentNotificationCreateView,
    AgentReportAlertAcknowledgeView,
    AgentReportAlertListView,
    AgentRequestDetailView,
    AgentRequestListView,
    AgentRequestSimilarView,
    AgentRequestSummaryView,
    AgentRequestTimelineView,
    CitizenContactMessageDetailView,
    CitizenContactMessageListView,
    CitizenAppointmentAgentListView,
    CitizenAppointmentAvailabilityView,
    CitizenAppointmentDetailView,
    CitizenAppointmentListCreateView,
    CitizenDashboardView,
    CitizenIssueReportCreateView,
    CitizenOnboardingView,
    CitizenPreferencesView,
    CitizenNotificationDetailView,
    CitizenNotificationListView,
    CitizenNotificationReadAllView,
    CitizenRequestDetailView,
    CitizenRequestHistoryView,
    CitizenRequestListCreateView,
    CitizenRequestTimelineView,
    CityLanguageListView,
    ContactMessageCreateView,
    MunicipalServiceDetailView,
    MunicipalServiceHighlightsView,
    MunicipalServiceListView,
    NewsDetailView,
    NewsListView,
    WebCupRequestsView,
    WebCupSnapshotListView,
    WebCupStatusView,
)

app_name = "city"

urlpatterns = [
    path("city/alerts/", ActiveAlertListView.as_view(), name="active-alert-list"),
    path("city/news/<slug:slug>/cover/", NewsCoverView.as_view(), name="news-cover"),
    path("admin/news/<slug:slug>/cover/", AdminNewsCoverView.as_view(), name="admin-news-cover"),
    path("admin/news/<slug:slug>/delivery/", AdminNewsDeliveryView.as_view(), name="admin-news-delivery"),
    # Public
    path("city/languages/", CityLanguageListView.as_view(), name="language-list"),
    path("city/services/", MunicipalServiceListView.as_view(), name="service-list"),
    path("city/services/highlights/", MunicipalServiceHighlightsView.as_view(), name="service-highlights"),
    path("city/services/<slug:slug>/", MunicipalServiceDetailView.as_view(), name="service-detail"),
    path("city/news/", NewsListView.as_view(), name="news-list"),
    path("city/news/<slug:slug>/", NewsDetailView.as_view(), name="news-detail"),
    path("city/contact/", ContactMessageCreateView.as_view(), name="contact"),

    # Citizen
    path("citizen/dashboard/", CitizenDashboardView.as_view(), name="citizen-dashboard"),
    path("citizen/preferences/", CitizenPreferencesView.as_view(), name="citizen-preferences"),
    path("citizen/onboarding/", CitizenOnboardingView.as_view(), name="citizen-onboarding"),
    path("citizen/requests/", CitizenRequestListCreateView.as_view(), name="citizen-request-list"),
    path("citizen/requests/history/", CitizenRequestHistoryView.as_view(), name="citizen-request-history"),
    path("citizen/reports/", CitizenIssueReportCreateView.as_view(), name="citizen-report-create"),
    path("citizen/requests/<str:reference>/timeline/", CitizenRequestTimelineView.as_view(), name="citizen-request-timeline"),
    path("citizen/requests/<str:reference>/", CitizenRequestDetailView.as_view(), name="citizen-request-detail"),
    path("citizen/contact-messages/", CitizenContactMessageListView.as_view(), name="citizen-contact-list"),
    path("citizen/contact-messages/<str:reference>/", CitizenContactMessageDetailView.as_view(), name="citizen-contact-detail"),
    path("citizen/notifications/", CitizenNotificationListView.as_view(), name="citizen-notification-list"),
    path("citizen/notifications/read-all/", CitizenNotificationReadAllView.as_view(), name="citizen-notification-read-all"),
    path("citizen/notifications/<int:pk>/", CitizenNotificationDetailView.as_view(), name="citizen-notification-detail"),
    path("citizen/appointments/agents/", CitizenAppointmentAgentListView.as_view(), name="citizen-appointment-agent-list"),
    path("citizen/appointments/availability/", CitizenAppointmentAvailabilityView.as_view(), name="citizen-appointment-availability"),
    path("citizen/appointments/", CitizenAppointmentListCreateView.as_view(), name="citizen-appointment-list"),
    path("citizen/appointments/<str:reference>/", CitizenAppointmentDetailView.as_view(), name="citizen-appointment-detail"),

    # Agent operational space
    path("agent/dashboard/", AgentDashboardView.as_view(), name="agent-dashboard"),
    path("agent/audit/", AgentAuditListView.as_view(), name="agent-audit-list"),
    path("agent/audit/<int:pk>/", AgentAuditDetailView.as_view(), name="agent-audit-detail"),
    path("agent/notifications/", AgentNotificationCreateView.as_view(), name="agent-notification-create"),
    path("agent/appointments/", AgentAppointmentListView.as_view(), name="agent-appointment-list"),
    path("agent/appointments/<str:reference>/", AgentAppointmentDetailView.as_view(), name="agent-appointment-detail"),
    path("agent/requests/", AgentRequestListView.as_view(), name="agent-request-list"),
    path("agent/requests/summary/", AgentRequestSummaryView.as_view(), name="agent-request-summary"),
    path("agent/report-alerts/", AgentReportAlertListView.as_view(), name="agent-report-alert-list"),
    path("agent/report-alerts/<str:reference>/acknowledge/", AgentReportAlertAcknowledgeView.as_view(), name="agent-report-alert-acknowledge"),
    path("agent/requests/<str:reference>/similar/", AgentRequestSimilarView.as_view(), name="agent-request-similar"),
    path("agent/requests/<str:reference>/timeline/", AgentRequestTimelineView.as_view(), name="agent-request-timeline"),
    path("agent/requests/<str:reference>/", AgentRequestDetailView.as_view(), name="agent-request-detail"),
    path("agent/assignees/", AgentAssigneeListView.as_view(), name="agent-assignee-list"),
    path("agent/contact-messages/", AgentContactMessageListView.as_view(), name="agent-contact-list"),
    path("agent/contact-messages/<str:reference>/", AgentContactMessageDetailView.as_view(), name="agent-contact-detail"),
    path(
        "agent/services/<slug:slug>/availability/",
        ServiceAvailabilityView.as_view(),
        name="agent-service-availability",
    ),

    # Admin API. Deliberately separate from Django /admin/.
    path("admin/dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("admin/audit/", AdminAuditListView.as_view(), name="admin-audit-list"),
    path("admin/audit/<int:pk>/", AdminAuditDetailView.as_view(), name="admin-audit-detail"),
    path("admin/users/", AdminUserListCreateView.as_view(), name="admin-user-list"),
    path("admin/users/<int:pk>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("admin/services/", AdminServiceListCreateView.as_view(), name="admin-service-list"),
    path("admin/services/<slug:slug>/availability/", ServiceAvailabilityView.as_view(), name="admin-service-availability"),
    path("admin/services/<slug:slug>/", AdminServiceDetailView.as_view(), name="admin-service-detail"),
    path("admin/news/", AdminNewsListCreateView.as_view(), name="admin-news-list"),
    path("admin/news/<slug:slug>/", AdminNewsDetailView.as_view(), name="admin-news-detail"),
    path("admin/notifications/", AdminNotificationCreateView.as_view(), name="admin-notification-create"),
    path("admin/appointments/", AdminAppointmentListView.as_view(), name="admin-appointment-list"),
    path("admin/appointments/<str:reference>/", AdminAppointmentDetailView.as_view(), name="admin-appointment-detail"),
    path("admin/contact-messages/", AdminContactMessageListView.as_view(), name="admin-contact-list"),
    path("admin/contact-messages/<str:reference>/", AdminContactMessageDetailView.as_view(), name="admin-contact-detail"),
    path("admin/requests/", AdminRequestListView.as_view(), name="admin-request-list"),
    path("admin/requests/summary/", AdminRequestSummaryView.as_view(), name="admin-request-summary"),
    path("admin/report-alerts/", AdminReportAlertListView.as_view(), name="admin-report-alert-list"),
    path("admin/report-alerts/<str:reference>/acknowledge/", AdminReportAlertAcknowledgeView.as_view(), name="admin-report-alert-acknowledge"),
    path("admin/requests/<str:reference>/similar/", AdminRequestSimilarView.as_view(), name="admin-request-similar"),
    path("admin/requests/<str:reference>/timeline/", AdminRequestTimelineView.as_view(), name="admin-request-timeline"),
    path("admin/requests/<str:reference>/", AdminRequestDetailView.as_view(), name="admin-request-detail"),
    path("admin/system/", AdminSystemView.as_view(), name="admin-system"),

    # WebCup feed: never expose the upstream API key to the frontend.
    path("webcup/requests/", WebCupRequestsView.as_view(), name="webcup-requests"),
    path("webcup/requests/local/", WebCupSnapshotListView.as_view(), name="webcup-request-snapshots"),
    path("webcup/status/", WebCupStatusView.as_view(), name="webcup-status"),
]

from .report_views import (
    ReportCategoryView, CitizenReportDetailView, CitizenReportSummaryView,
    CitizenReportMessageView, CitizenReportCancelView, CitizenReportReopenView,
    ReportAttachmentListView, AgentReportAttachmentListView, ReportAttachmentDetailView,
    ReportImageDownloadView,
)
report_urls = [
    path('citizen/reports/categories/', ReportCategoryView.as_view(), name='report-categories'),
    path('citizen/reports/summary/', CitizenReportSummaryView.as_view(), name='report-summary'),
    path('citizen/reports/attachments/<uuid:pk>/download/', ReportImageDownloadView.as_view(), name='report-image-download'),
    path('citizen/reports/attachments/<uuid:pk>/', ReportAttachmentDetailView.as_view(), name='report-attachment-detail'),
    path('citizen/reports/<str:reference>/messages/', CitizenReportMessageView.as_view(), name='report-messages'),
    path('citizen/reports/<str:reference>/attachments/', ReportAttachmentListView.as_view(), name='report-attachments'),
    path('citizen/reports/<str:reference>/cancel/', CitizenReportCancelView.as_view(), name='report-cancel'),
    path('citizen/reports/<str:reference>/reopen/', CitizenReportReopenView.as_view(), name='report-reopen'),
    path('citizen/reports/<str:reference>/', CitizenReportDetailView.as_view(), name='report-detail'),
    path('agent/reports/<str:reference>/attachments/', AgentReportAttachmentListView.as_view(), name='agent-report-attachments'),
]
urlpatterns = report_urls + urlpatterns
from .report_views import AgentReportReopenView
urlpatterns += [path('agent/reports/<str:reference>/reopen/', AgentReportReopenView.as_view(), name='agent-report-reopen')]

# Projets municipaux & participation citoyenne (F65-F68).
# Ce bloc reste volontairement séparé des CitizenRequest existantes.
from .project_views import (
    AdminMunicipalIdeaDetailView,
    AdminMunicipalIdeaListView,
    AdminProjectContributionListView,
    AdminProjectDetailView,
    AdminProjectListCreateView,
    CitizenIdeaDetailView,
    CitizenIdeaListCreateView,
    CitizenProjectParticipationView,
    CitizenProjectSupportView,
    MunicipalProjectDetailView,
    MunicipalProjectListView,
)

urlpatterns += [
    # Consultation publique des projets (F67)
    path("city/projects/", MunicipalProjectListView.as_view(), name="project-list"),
    path("city/projects/<slug:slug>/", MunicipalProjectDetailView.as_view(), name="project-detail"),

    # Participation citoyenne : avis/décision, soutien et idées/solutions (F65/F66/F68)
    path(
        "citizen/projects/<slug:slug>/participation/",
        CitizenProjectParticipationView.as_view(),
        name="citizen-project-participation",
    ),
    path(
        "citizen/projects/<slug:slug>/support/",
        CitizenProjectSupportView.as_view(),
        name="citizen-project-support",
    ),
    path("citizen/ideas/", CitizenIdeaListCreateView.as_view(), name="citizen-idea-list"),
    path(
        "citizen/ideas/<str:reference>/",
        CitizenIdeaDetailView.as_view(),
        name="citizen-idea-detail",
    ),

    # Administration du même module, sans dupliquer l'architecture agent/admin existante.
    path("admin/projects/", AdminProjectListCreateView.as_view(), name="admin-project-list"),
    path(
        "admin/projects/<slug:slug>/",
        AdminProjectDetailView.as_view(),
        name="admin-project-detail",
    ),
    path(
        "admin/project-participations/",
        AdminProjectContributionListView.as_view(),
        name="admin-project-participation-list",
    ),
    path("admin/ideas/", AdminMunicipalIdeaListView.as_view(), name="admin-idea-list"),
    path(
        "admin/ideas/<str:reference>/",
        AdminMunicipalIdeaDetailView.as_view(),
        name="admin-idea-detail",
    ),
]


# Mobilité / partenaires / géolocalisation (F36/F45/F46 + bloc partenaires).
from .location_views import (
    AdminCityLocationDetailView,
    AdminCityLocationListCreateView,
    CityLocationDetailView,
    CityLocationListView,
    EmergencyLocationListView,
    TransportInfoView,
)

urlpatterns += [
    path("city/locations/", CityLocationListView.as_view(), name="city-location-list"),
    path("city/locations/emergency/", EmergencyLocationListView.as_view(), name="city-emergency-location-list"),
    path("city/locations/<slug:slug>/", CityLocationDetailView.as_view(), name="city-location-detail"),
    path("city/transport/", TransportInfoView.as_view(), name="city-transport-info"),
    path("admin/locations/", AdminCityLocationListCreateView.as_view(), name="admin-location-list"),
    path("admin/locations/<slug:slug>/", AdminCityLocationDetailView.as_view(), name="admin-location-detail"),
]

# Engagement citoyen sécurisé : soutien de demandes (F52), avis service (F76),
# préoccupations données personnelles (F51).
from .engagement_views import (
    AdminPrivacyConcernDetailView,
    AdminPrivacyConcernListView,
    AdminServiceFeedbackListView,
    CitizenPrivacyConcernDetailView,
    CitizenPrivacyConcernListCreateView,
    CitizenRequestSupportView,
    CitizenServiceFeedbackView,
    SupportableCitizenRequestListView,
)

urlpatterns += [
    # F52 — seuls des champs non personnels des signalements soutenables sont exposés.
    path("citizen/supportable-requests/", SupportableCitizenRequestListView.as_view(), name="citizen-supportable-request-list"),
    path("citizen/requests/<str:reference>/support/", CitizenRequestSupportView.as_view(), name="citizen-request-support"),

    # F76 — avis uniquement après une utilisation vérifiable du service.
    path("citizen/services/<slug:slug>/feedback/", CitizenServiceFeedbackView.as_view(), name="citizen-service-feedback"),
    path("admin/service-feedback/", AdminServiceFeedbackListView.as_view(), name="admin-service-feedback-list"),

    # F51 — canal confidentiel distinct du contact générique.
    path("citizen/privacy-concerns/", CitizenPrivacyConcernListCreateView.as_view(), name="citizen-privacy-concern-list"),
    path("citizen/privacy-concerns/<str:reference>/", CitizenPrivacyConcernDetailView.as_view(), name="citizen-privacy-concern-detail"),
    path("admin/privacy-concerns/", AdminPrivacyConcernListView.as_view(), name="admin-privacy-concern-list"),
    path("admin/privacy-concerns/<str:reference>/", AdminPrivacyConcernDetailView.as_view(), name="admin-privacy-concern-detail"),
]
