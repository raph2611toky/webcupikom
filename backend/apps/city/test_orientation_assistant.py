from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import MunicipalService


class CitizenOrientationAssistantTests(APITestCase):
    def setUp(self):
        services = {
            "administration": ("Administration", "Démarches administratives et documents officiels."),
            "transport": ("Transport", "Mobilité, circulation et transports municipaux."),
            "sante": ("Santé", "Information et orientation vers les services de santé."),
            "habitat": ("Habitat", "Logement et démarches liées à l'habitat."),
            "energie": ("Énergie", "Électricité, énergie et éclairage public."),
            "securite": ("Sécurité", "Orientation municipale en matière de sécurité."),
        }
        for index, (slug, (name, description)) in enumerate(services.items(), start=1):
            MunicipalService.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "category": name,
                    "short_description": description,
                    "sort_order": index * 10,
                    "priority_order": index * 10,
                    "is_active": True,
                },
            )

    def orient(self, message, **extra):
        return self.client.post(
            reverse("assistant:orient"),
            {"message": message, **extra},
            format="json",
        )

    def test_endpoint_is_public_and_routes_lighting_report_with_typo(self):
        response = self.orient("Le lampadair est cassé et la rue reste noire")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["type"], "report")
        self.assertEqual(response.data["category"], "street_lighting")
        self.assertEqual(response.data["action"], "create_report")
        self.assertEqual(response.data["recommended_service"]["slug"], "energie")
        self.assertGreaterEqual(response.data["confidence"], 0.50)

    def test_plain_health_question_is_not_misclassified_as_emergency(self):
        response = self.orient("Je cherche un médecin pour savoir où consulter")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["type"], "service")
        self.assertEqual(response.data["recommended_service"]["slug"], "sante")
        self.assertFalse(response.data["emergency"])

    def test_explicit_medical_emergency_uses_emergency_report_route(self):
        response = self.orient("Urgence médicale, une personne est inconsciente et ne respire plus")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["type"], "report")
        self.assertEqual(response.data["category"], "medical_emergency")
        self.assertTrue(response.data["emergency"])
        self.assertFalse(response.data["needs_confirmation"])
        self.assertGreaterEqual(response.data["confidence"], 0.90)

    def test_lost_papers_routes_to_administration(self):
        response = self.orient("J'ai perdu mes papiers d'identité et je dois refaire mes documents")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["type"], "service")
        self.assertEqual(response.data["recommended_service"]["slug"], "administration")

    def test_transport_tolerates_typo(self):
        response = self.orient("Je cherche les horraires du buss municipal")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["recommended_service"]["slug"], "transport")

    def test_low_confidence_never_forces_a_service(self):
        response = self.orient("Quelque chose de bizarre dont je ne connais pas le domaine")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["type"], "suggestions")
        self.assertEqual(response.data["intent"], "unknown")
        self.assertTrue(response.data["needs_confirmation"])
        self.assertIsNone(response.data["recommended_service"])
        self.assertGreater(len(response.data["suggestions"]), 0)

    def test_english_report_is_supported(self):
        response = self.orient("The street light is broken and the road is dark", language="en")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["category"], "street_lighting")
        self.assertEqual(response.data["language"], "en")

    def test_validation_rejects_empty_or_oversized_messages(self):
        short = self.orient("x")
        self.assertEqual(short.status_code, status.HTTP_400_BAD_REQUEST)
        long = self.orient("a" * 601)
        self.assertEqual(long.status_code, status.HTTP_400_BAD_REQUEST)

    def test_capabilities_explain_privacy_and_supported_languages(self):
        response = self.client.get(reverse("assistant:capabilities"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["languages"], ["fr", "en"])
        self.assertFalse(response.data["persists_messages"])
        self.assertTrue(response.data["uses_existing_services_only"])
