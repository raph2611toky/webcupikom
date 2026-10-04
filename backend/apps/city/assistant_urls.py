from django.urls import path

from .assistant_views import CitizenOrientationCapabilitiesView, CitizenOrientationView

app_name = "assistant"

urlpatterns = [
    path("orient/", CitizenOrientationView.as_view(), name="orient"),
    path("capabilities/", CitizenOrientationCapabilitiesView.as_view(), name="capabilities"),
]
