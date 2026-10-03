from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User

from .models import CityLocation, MunicipalService, StaffAuditEvent


class CityLocationApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="location-admin@example.com",
            password="StrongPass123!",
            role=User.Role.ADMIN,
            email_verified=True,
            is_active=True,
        )
        self.transport = MunicipalService.objects.create(
            name="Transport municipal",
            slug="transport-location-tests",
            category="Mobilité",
            short_description="Informations de mobilité",
            opening_hours="06:00-22:00",
        )
        self.stop = CityLocation.objects.create(
            name="Pôle Nova Centre",
            slug="pole-nova-centre",
            kind=CityLocation.Kind.TRANSPORT_STOP,
            category="Mobilité",
            service=self.transport,
            district="Nova Centre",
            address="Place centrale",
            opening_hours="06:00-22:00",
            latitude=Decimal("-18.910000"),
            longitude=Decimal("47.520000"),
            transport_lines=["T1", "T2"],
            timetable=[{"line": "T1", "departure": "06:30"}],
        )
        self.hospital = CityLocation.objects.create(
            name="Hôpital Nova Sud",
            slug="hopital-nova-sud",
            kind=CityLocation.Kind.HOSPITAL,
            category="Santé",
            district="Nova Sud",
            address="Avenue de la Santé",
            opening_hours="24h/24",
            latitude=Decimal("-18.920000"),
            longitude=Decimal("47.530000"),
        )
        self.partner = CityLocation.objects.create(
            name="Maison partenaire Nova",
            slug="maison-partenaire-nova",
            kind=CityLocation.Kind.PARTNER,
            partner_name="Association Nova",
            district="Nova Centre",
            address="Rue des partenaires",
            opening_hours="08:00-17:00",
            latitude=Decimal("-18.911000"),
            longitude=Decimal("47.521000"),
        )

    def test_public_location_list_filters_partner_and_exposes_opening_hours(self):
        response = self.client.get(reverse("city:city-location-list"), {"partner": "true"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["slug"], self.partner.slug)
        self.assertEqual(response.data[0]["opening_hours"], "08:00-17:00")
        self.assertEqual(response.data[0]["partner_name"], "Association Nova")

    def test_nearby_locations_are_sorted_by_distance(self):
        response = self.client.get(
            reverse("city:city-location-list"),
            {"lat": "-18.910100", "lon": "47.520100", "radius_km": "5"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 2)
        self.assertEqual(response.data[0]["slug"], self.stop.slug)
        self.assertIsNotNone(response.data[0]["distance_km"])

    def test_transport_endpoint_exposes_lines_and_timetable(self):
        response = self.client.get(reverse("city:city-transport-info"), {"line": "T1"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["locations"][0]["transport_lines"], ["T1", "T2"])
        self.assertEqual(response.data["locations"][0]["timetable"][0]["departure"], "06:30")

    def test_emergency_endpoint_only_returns_hospital_and_emergency(self):
        response = self.client.get(reverse("city:city-emergency-location-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = {item["slug"] for item in response.data}
        self.assertIn(self.hospital.slug, slugs)
        self.assertNotIn(self.partner.slug, slugs)
        self.assertNotIn(self.stop.slug, slugs)

    def test_admin_can_create_partner_location_and_action_is_audited(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse("city:admin-location-list"),
            {
                "name": "Partenaire mobilité Est",
                "kind": "partner",
                "partner_name": "Mobilité Est SARL",
                "category": "Mobilité",
                "district": "Nova Est",
                "address": "Rue Est",
                "opening_hours": "07:00-19:00",
                "latitude": "-18.930000",
                "longitude": "47.540000",
                "practical_info": {"appointment_required": False},
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        slug = response.data["slug"]
        self.assertTrue(CityLocation.objects.filter(slug=slug, kind="partner").exists())
        self.assertTrue(StaffAuditEvent.objects.filter(action="location.create", resource_reference=slug).exists())

    def test_admin_delete_soft_disables_location_and_public_hides_it(self):
        self.client.force_authenticate(self.admin)
        response = self.client.delete(
            reverse("city:admin-location-detail", kwargs={"slug": self.partner.slug})
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.partner.refresh_from_db()
        self.assertFalse(self.partner.is_active)
        public = self.client.get(
            reverse("city:city-location-detail", kwargs={"slug": self.partner.slug})
        )
        self.assertEqual(public.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_rejects_incomplete_coordinates(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse("city:admin-location-list"),
            {
                "name": "Lieu invalide",
                "kind": "service",
                "address": "Nova Terra",
                "latitude": "-18.9",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
