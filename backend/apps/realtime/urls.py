from django.urls import path

from .views import RealtimeStatusView, RealtimeTicketView

app_name = "realtime"

urlpatterns = [
    path("status/", RealtimeStatusView.as_view(), name="status"),
    path("ticket/", RealtimeTicketView.as_view(), name="ticket"),
]
