from django.urls import path

from .views import (
    AgentRequestDetailView,
    AgentRequestListView,
    CitizenRequestDetailView,
    CitizenRequestListCreateView,
    ContactMessageCreateView,
    MunicipalServiceDetailView,
    MunicipalServiceListView,
    NewsDetailView,
    NewsListView,
    WebCupRequestsView,
)

app_name = "city"

urlpatterns = [
    path("city/services/", MunicipalServiceListView.as_view(), name="service-list"),
    path("city/services/<slug:slug>/", MunicipalServiceDetailView.as_view(), name="service-detail"),
    path("city/news/", NewsListView.as_view(), name="news-list"),
    path("city/news/<slug:slug>/", NewsDetailView.as_view(), name="news-detail"),
    path("city/contact/", ContactMessageCreateView.as_view(), name="contact"),

    path("citizen/requests/", CitizenRequestListCreateView.as_view(), name="citizen-request-list"),
    path("citizen/requests/<str:reference>/", CitizenRequestDetailView.as_view(), name="citizen-request-detail"),

    path("agent/requests/", AgentRequestListView.as_view(), name="agent-request-list"),
    path("agent/requests/<str:reference>/", AgentRequestDetailView.as_view(), name="agent-request-detail"),

    path("webcup/requests/", WebCupRequestsView.as_view(), name="webcup-requests"),
]
