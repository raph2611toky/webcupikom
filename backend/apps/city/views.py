from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CitizenRequest, MunicipalService, NewsArticle
from .permissions import IsAgentOrAdmin, IsCitizen
from .serializers import (
    AgentCitizenRequestSerializer,
    CitizenRequestSerializer,
    ContactMessageCreateSerializer,
    ContactMessageReceiptSerializer,
    MunicipalServiceSerializer,
    NewsArticleSerializer,
)
from .services.webcup import WebCupUpstreamError, get_webcup_requests


class MunicipalServiceListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = MunicipalServiceSerializer

    def get_queryset(self):
        queryset = MunicipalService.objects.filter(is_active=True)
        category = self.request.query_params.get("category")
        search = self.request.query_params.get("search")
        if category:
            queryset = queryset.filter(category__iexact=category.strip())
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(short_description__icontains=search)
                | Q(description__icontains=search)
            )
        return queryset


class MunicipalServiceDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = MunicipalServiceSerializer
    lookup_field = "slug"
    queryset = MunicipalService.objects.filter(is_active=True)


class NewsListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = NewsArticleSerializer

    def get_queryset(self):
        queryset = NewsArticle.objects.filter(is_published=True)
        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category__iexact=category.strip())
        return queryset


class NewsDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = NewsArticleSerializer
    lookup_field = "slug"
    queryset = NewsArticle.objects.filter(is_published=True)


class ContactMessageCreateView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = ContactMessageCreateSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(
            {
                "message": "Message envoyé avec succès.",
                "request": ContactMessageReceiptSerializer(instance).data,
            },
            status=status.HTTP_201_CREATED,
        )


class CitizenRequestListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsCitizen]
    serializer_class = CitizenRequestSerializer

    def get_queryset(self):
        queryset = CitizenRequest.objects.filter(citizen=self.request.user).select_related("service", "assigned_to")
        request_status = self.request.query_params.get("status")
        if request_status:
            queryset = queryset.filter(status=request_status)
        return queryset


class CitizenRequestDetailView(generics.RetrieveAPIView):
    permission_classes = [IsCitizen]
    serializer_class = CitizenRequestSerializer
    lookup_field = "reference"

    def get_queryset(self):
        return CitizenRequest.objects.filter(citizen=self.request.user).select_related("service", "assigned_to")


class AgentRequestListView(generics.ListAPIView):
    permission_classes = [IsAgentOrAdmin]
    serializer_class = AgentCitizenRequestSerializer

    def get_queryset(self):
        queryset = CitizenRequest.objects.select_related("citizen", "service", "assigned_to")
        request_status = self.request.query_params.get("status")
        service = self.request.query_params.get("service")
        search = self.request.query_params.get("search")
        if request_status:
            queryset = queryset.filter(status=request_status)
        if service:
            queryset = queryset.filter(Q(service_id=service) | Q(service__slug=service))
        if search:
            queryset = queryset.filter(
                Q(reference__icontains=search)
                | Q(title__icontains=search)
                | Q(citizen__email__icontains=search)
                | Q(citizen__first_name__icontains=search)
                | Q(citizen__last_name__icontains=search)
            )
        return queryset


class AgentRequestDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAgentOrAdmin]
    serializer_class = AgentCitizenRequestSerializer
    lookup_field = "reference"
    queryset = CitizenRequest.objects.select_related("citizen", "service", "assigned_to")

    def patch(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)


class WebCupRequestsView(APIView):
    permission_classes = [IsAgentOrAdmin]

    def get(self, request):
        force = request.query_params.get("force", "").strip().lower() in {"1", "true", "yes"}
        try:
            return Response(get_webcup_requests(force=force))
        except WebCupUpstreamError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
