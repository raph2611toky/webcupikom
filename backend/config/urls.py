from django.contrib import admin
from django.urls import path
from views import health

urlpatterns = [
    path("health/", health),
    path('admin/', admin.site.urls),
]
