from math import asin, cos, radians, sin, sqrt

from django.db import transaction
from django.db.models import Q
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from helpers.permissions import IsAuthenticatedAdmin

from .models import CityLocation, MunicipalService, NewsArticle
from .serializers import (
    AdminCityLocationSerializer,
    CityLocationSerializer,
    MunicipalServiceSerializer,
)
from .services.audit import record_staff_audit
from .services.news import active_news, ordered_news


def _bool_param(value):
    if value is None or value == "":
        return None
    value = str(value).strip().lower()
    if value in {"1", "true", "yes", "oui"}:
        return True
    if value in {"0", "false", "no", "non"}:
        return False
    raise ValidationError("Valeur booléenne invalide.")


def _coordinates(params):
    raw_lat = params.get("lat")
    raw_lon = params.get("lon")
    if raw_lat in (None, "") and raw_lon in (None, ""):
        return None
    if raw_lat in (None, "") or raw_lon in (None, ""):
        raise ValidationError({"location": "lat et lon doivent être fournis ensemble."})
    try:
        lat, lon = float(raw_lat), float(raw_lon)
    except (TypeError, ValueError):
        raise ValidationError({"location": "lat et lon doivent être numériques."})
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        raise ValidationError({"location": "Coordonnées géographiques invalides."})
    return lat, lon


def _distance_km(lat1, lon1, lat2, lon2):
    # Haversine sans dépendance GIS : suffisant pour trier des lieux urbains.
    r = 6371.0088
    p1, p2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)
    a = sin(dphi / 2) ** 2 + cos(p1) * cos(p2) * sin(dlambda / 2) ** 2
    return 2 * r * asin(sqrt(a))


def _filtered_locations(request, *, kinds=None):
    qs = CityLocation.objects.filter(is_active=True).select_related("service")
    if kinds:
        qs = qs.filter(kind__in=kinds)

    kind = (request.query_params.get("kind") or "").strip()
    if kind:
        valid = {choice for choice, _ in CityLocation.Kind.choices}
        if kind not in valid:
            raise ValidationError({"kind": "Type de lieu invalide."})
        qs = qs.filter(kind=kind)

    category = (request.query_params.get("category") or "").strip()
    district = (request.query_params.get("district") or "").strip()
    service = (request.query_params.get("service") or "").strip()
    search = (request.query_params.get("search") or "").strip()
    partner = _bool_param(request.query_params.get("partner"))

    if category:
        qs = qs.filter(category__iexact=category)
    if district:
        qs = qs.filter(district__iexact=district)
    if service:
        if service.isdigit():
            qs = qs.filter(service_id=int(service))
        else:
            qs = qs.filter(service__slug=service)
    if partner is True:
        qs = qs.filter(kind=CityLocation.Kind.PARTNER)
    elif partner is False:
        qs = qs.exclude(kind=CityLocation.Kind.PARTNER)
    if search:
        qs = qs.filter(
            Q(name__icontains=search)
            | Q(description__icontains=search)
            | Q(address__icontains=search)
            | Q(district__icontains=search)
            | Q(partner_name__icontains=search)
            | Q(service__name__icontains=search)
        )
    return qs


LOCATION_QUERY_PARAMETERS = [
    openapi.Parameter("kind", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=False,
                      description="service, transport_stop, hospital, emergency ou partner"),
    openapi.Parameter("category", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=False),
    openapi.Parameter("district", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=False),
    openapi.Parameter("service", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=False,
                      description="ID ou slug du service municipal"),
    openapi.Parameter("partner", openapi.IN_QUERY, type=openapi.TYPE_BOOLEAN, required=False),
    openapi.Parameter("search", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=False),
    openapi.Parameter("lat", openapi.IN_QUERY, type=openapi.TYPE_NUMBER, required=False),
    openapi.Parameter("lon", openapi.IN_QUERY, type=openapi.TYPE_NUMBER, required=False),
    openapi.Parameter("radius_km", openapi.IN_QUERY, type=openapi.TYPE_NUMBER, required=False,
                      description="Rayon maximum autour de lat/lon, 100 km maximum"),
]


class CityLocationListView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @swagger_auto_schema(
        operation_id="city_location_list",
        summary="Lister les lieux géolocalisés de Nova Terra",
        description="F45/F46 et partenaires : services physiques, transports, santé, urgences et partenaires.",
        manual_parameters=LOCATION_QUERY_PARAMETERS,
        responses={200: CityLocationSerializer(many=True)},
        tags=["Ville - Géolocalisation"],
    )
    def get(self, request):
        qs = _filtered_locations(request)
        origin = _coordinates(request.query_params)
        distance_map = {}
        items = list(qs)
        if origin:
            lat, lon = origin
            try:
                radius = float(request.query_params.get("radius_km", 100))
            except (TypeError, ValueError):
                raise ValidationError({"radius_km": "Rayon invalide."})
            if radius <= 0 or radius > 100:
                raise ValidationError({"radius_km": "Le rayon doit être compris entre 0 et 100 km."})
            filtered = []
            for item in items:
                if item.latitude is None or item.longitude is None:
                    continue
                distance = _distance_km(lat, lon, float(item.latitude), float(item.longitude))
                if distance <= radius:
                    distance_map[item.pk] = distance
                    filtered.append(item)
            items = sorted(filtered, key=lambda item: distance_map[item.pk])

        return Response(CityLocationSerializer(
            items, many=True, context={"request": request, "distance_map": distance_map}
        ).data)


class CityLocationDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = CityLocationSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return CityLocation.objects.filter(is_active=True).select_related("service")


class TransportInfoView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @swagger_auto_schema(
        operation_id="city_transport_info",
        summary="Consulter les transports municipaux",
        description="F36 + F97 : informations de mobilité, horaires, interruptions actives et solutions de remplacement.",
        manual_parameters=[
            openapi.Parameter("district", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=False),
            openapi.Parameter("line", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=False,
                              description="Filtre une ligne présente dans transport_lines"),
        ],
        tags=["Ville - Transport"],
    )
    def get(self, request):
        qs = _filtered_locations(request, kinds=[CityLocation.Kind.TRANSPORT_STOP])
        line = (request.query_params.get("line") or "").strip().lower()
        items = list(qs)
        if line:
            items = [
                item for item in items
                if any(str(value).strip().lower() == line for value in (item.transport_lines or []))
            ]
        transport_service = MunicipalService.objects.filter(slug="transport").first()

        disruptions_qs = NewsArticle.objects.filter(
            active_news(),
            publication_type="alert",
        ).filter(
            Q(category__iexact="transport")
            | Q(category__iexact="mobilité")
            | Q(service__slug__in=["transport", "mobilite"])
        ).select_related("service")

        disruptions = []
        replacement_options = []
        for article in ordered_news(disruptions_qs):
            guidance = []
            for row in article.audience_guidance or []:
                if not isinstance(row, dict):
                    continue
                audience = str(row.get("audience", "") or "").strip()
                instructions = str(row.get("instructions", "") or "").strip()
                if audience and instructions:
                    guidance.append({"audience": audience, "instructions": instructions})

            if line:
                matched = [
                    row for row in guidance
                    if line in row["audience"].casefold() or line in row["instructions"].casefold()
                ]
                haystack = " ".join([article.title, article.excerpt, article.affected_areas, article.instructions]).casefold()
                if not matched and line not in haystack:
                    continue
                alternatives = matched or guidance
            else:
                alternatives = guidance

            for row in alternatives:
                if row["instructions"] not in replacement_options:
                    replacement_options.append(row["instructions"])

            disruptions.append({
                "id": article.pk,
                "slug": article.slug,
                "title": article.title,
                "severity": article.severity,
                "affected_areas": article.affected_areas,
                "instructions": article.instructions,
                "alternatives": alternatives,
                "published_at": article.published_at,
                "expires_at": article.expires_at,
                "action_label": article.action_label,
                "action_url": article.action_url or f"/news/{article.slug}",
            })

        return Response({
            "service": (
                MunicipalServiceSerializer(transport_service, context={"request": request}).data
                if transport_service else None
            ),
            "count": len(items),
            "locations": CityLocationSerializer(items, many=True, context={"request": request}).data,
            "has_disruptions": bool(disruptions),
            "disruptions": disruptions,
            "replacement_options": replacement_options,
        })


class EmergencyLocationListView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @swagger_auto_schema(
        operation_id="city_emergency_location_list",
        summary="Lister les hôpitaux et services d'urgence",
        description="F46 : accès rapide aux lieux de santé et d'urgence.",
        manual_parameters=LOCATION_QUERY_PARAMETERS,
        responses={200: CityLocationSerializer(many=True)},
        tags=["Ville - Urgences"],
    )
    def get(self, request):
        qs = _filtered_locations(
            request,
            kinds=[CityLocation.Kind.HOSPITAL, CityLocation.Kind.EMERGENCY],
        )
        origin = _coordinates(request.query_params)
        distance_map = {}
        items = list(qs)
        if origin:
            lat, lon = origin
            try:
                radius = float(request.query_params.get("radius_km", 100))
            except (TypeError, ValueError):
                raise ValidationError({"radius_km": "Rayon invalide."})
            if radius <= 0 or radius > 100:
                raise ValidationError({"radius_km": "Le rayon doit être compris entre 0 et 100 km."})
            filtered = []
            for item in items:
                if item.latitude is None or item.longitude is None:
                    continue
                distance = _distance_km(lat, lon, float(item.latitude), float(item.longitude))
                if distance <= radius:
                    distance_map[item.pk] = distance
                    filtered.append(item)
            items = sorted(filtered, key=lambda item: distance_map[item.pk])
        return Response(CityLocationSerializer(
            items, many=True, context={"request": request, "distance_map": distance_map}
        ).data)


class AdminCityLocationListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminCityLocationSerializer

    def get_queryset(self):
        qs = CityLocation.objects.select_related("service").all()
        active = _bool_param(self.request.query_params.get("active"))
        kind = (self.request.query_params.get("kind") or "").strip()
        district = (self.request.query_params.get("district") or "").strip()
        search = (self.request.query_params.get("search") or "").strip()
        if active is not None:
            qs = qs.filter(is_active=active)
        if kind:
            qs = qs.filter(kind=kind)
        if district:
            qs = qs.filter(district__iexact=district)
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(address__icontains=search) | Q(partner_name__icontains=search))
        return qs

    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save()
        record_staff_audit(
            actor=self.request.user,
            action="location.create",
            resource_type="location",
            resource_id=instance.pk,
            resource_reference=instance.slug,
            summary="Lieu géolocalisé créé",
            changes={"kind": instance.kind, "is_active": instance.is_active},
            request=self.request,
        )


class AdminCityLocationDetailView(generics.RetrieveUpdateDestroyAPIView):
    http_method_names = ["get", "patch", "delete", "head", "options"]
    permission_classes = [IsAuthenticatedAdmin]
    serializer_class = AdminCityLocationSerializer
    lookup_field = "slug"
    queryset = CityLocation.objects.select_related("service").all()

    @transaction.atomic
    def perform_update(self, serializer):
        instance = serializer.instance
        tracked = (
            "name", "kind", "category", "service_id", "partner_name", "address", "district",
            "opening_hours", "phone", "email", "website", "latitude", "longitude",
            "transport_lines", "timetable", "practical_info", "is_active", "sort_order",
        )
        before = {field: getattr(instance, field) for field in tracked}
        instance = serializer.save()
        changed = [field for field in tracked if before[field] != getattr(instance, field)]
        if changed:
            record_staff_audit(
                actor=self.request.user,
                action="location.update",
                resource_type="location",
                resource_id=instance.pk,
                resource_reference=instance.slug,
                summary="Lieu géolocalisé modifié",
                changes={"fields": changed},
                request=self.request,
            )

    @transaction.atomic
    def perform_destroy(self, instance):
        if instance.is_active:
            instance.is_active = False
            instance.save(update_fields=["is_active", "updated_at"])
        record_staff_audit(
            actor=self.request.user,
            action="location.deactivate",
            resource_type="location",
            resource_id=instance.pk,
            resource_reference=instance.slug,
            summary="Lieu géolocalisé désactivé",
            changes={"is_active": False},
            request=self.request,
        )
