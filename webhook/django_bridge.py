import os
import re
import sys
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace


class NovaTerraBridge:
    def __init__(self):
        self.backend_path = Path(os.getenv("NOVA_TERRA_BACKEND_PATH", "../backend")).resolve()
        self.force_sqlite = os.getenv("NOVA_TERRA_FORCE_SQLITE", "true").lower() in {"1", "true", "yes", "on"}
        self._ready = False

    def setup(self):
        if self._ready:
            return
        if not (self.backend_path / "manage.py").exists():
            raise RuntimeError(f"Backend Nova Terra introuvable: {self.backend_path}")
        if str(self.backend_path) not in sys.path:
            sys.path.insert(0, str(self.backend_path))
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", os.getenv("NOVA_TERRA_DJANGO_SETTINGS", "config.settings"))
        if self.force_sqlite:
            # Empêche le .env Django de basculer vers MySQL et force le db.sqlite3 du backend.
            os.environ["DB_NAME"] = ""
        import django
        django.setup()
        self._ready = True

    @staticmethod
    def _digits(value: str) -> str:
        return re.sub(r"\D", "", value or "")

    def find_citizen(self, phone: str):
        self.setup()
        from apps.users.models import User
        target = self._digits(phone)
        if not target:
            return None
        candidates = User.objects.filter(role=User.Role.CITIZEN, is_active=True).exclude(phone_number="")
        target_forms = self._phone_forms(target)
        matches = []
        for user in candidates.iterator(chunk_size=200):
            if target_forms.intersection(self._phone_forms(self._digits(user.phone_number))):
                matches.append(user)
                if len(matches) > 1:
                    return None
        return matches[0] if len(matches) == 1 else None

    @staticmethod
    def _phone_forms(digits: str) -> set[str]:
        d = re.sub(r"\D", "", digits or "")
        forms = {d} if d else set()
        if d.startswith("261") and len(d) > 3:
            forms.add("0" + d[3:])
        elif d.startswith("0") and len(d) > 1:
            forms.add("261" + d[1:])
        elif len(d) == 9:
            forms.add("261" + d)
            forms.add("0" + d)
        return forms

    def context(self, citizen=None) -> dict:
        self.setup()
        from apps.city.models import MunicipalService
        from apps.users.models import User
        from apps.city.services.reports import CATEGORIES
        services = list(MunicipalService.objects.order_by("sort_order", "name").values(
            "id", "name", "slug", "short_description", "opening_hours", "phone", "address",
            "actions", "required_documents", "faq", "is_active", "unavailability_reason", "alternative_action"
        )[:40])
        agents = list(User.objects.filter(role=User.Role.AGENT, is_active=True, email_verified=True).values("id", "first_name", "last_name")[:30])
        for row in agents:
            row["name"] = (f"{row.pop('first_name')} {row.pop('last_name')}").strip() or f"Agent {row['id']}"
        return {
            "capabilities": ["signalement", "démarche administrative", "rendez-vous", "message mairie/conseil", "suivi dossier", "information services"],
            "report_categories": CATEGORIES,
            "services": services,
            "functional_requirements": self._functional_requirements(),
            "agents": agents,
            "citizen_profile": ({"locale": citizen.locale} if citizen else None),
        }

    def validate(self, intent: str, draft: dict, citizen) -> dict:
        self.setup()
        request = SimpleNamespace(user=citizen)
        try:
            if intent == "report":
                from apps.city.serializers import CitizenIssueReportSerializer
                serializer = CitizenIssueReportSerializer(data=self._clean_report(draft), context={"request": request})
            elif intent == "procedure":
                from apps.city.serializers import CitizenRequestSerializer
                serializer = CitizenRequestSerializer(data=self._clean_procedure(draft), context={"request": request})
            elif intent == "appointment":
                from apps.city.serializers import CitizenAppointmentSerializer
                serializer = CitizenAppointmentSerializer(data=self._clean_appointment(draft), context={"request": request})
            elif intent == "contact":
                from apps.city.serializers import ContactMessageCreateSerializer
                data = self._clean_contact(draft, citizen)
                serializer = ContactMessageCreateSerializer(data=data, context={"request": request})
            else:
                return {"valid": False, "errors": {"intent": "Action non prise en charge."}}
            ok = serializer.is_valid()
            return {"valid": ok, "errors": serializer.errors if not ok else {}, "validated": serializer.validated_data if ok else {}}
        except Exception as exc:
            return {"valid": False, "errors": {"system": str(exc)}}

    def execute(self, intent: str, draft: dict, citizen) -> dict:
        self.setup()
        from django.db import transaction
        request = SimpleNamespace(user=citizen)
        with transaction.atomic():
            if intent == "report":
                from apps.city.models import CitizenNotification, CitizenRequest, CitizenRequestEvent
                from apps.city.serializers import CitizenIssueReportSerializer
                from apps.city.views import _create_request_event, _register_service_usage, _request_confirmation
                serializer = CitizenIssueReportSerializer(data=self._clean_report(draft), context={"request": request})
                serializer.is_valid(raise_exception=True)
                instance = serializer.save()
                _register_service_usage(instance.service_id)
                emergency = instance.handling_route == CitizenRequest.HandlingRoute.EMERGENCY
                _create_request_event(
                    instance, actor=citizen, event_type=CitizenRequestEvent.EventType.CREATED,
                    title="Signalement urgent enregistré" if emergency else "Signalement enregistré",
                    message=("Votre signalement urgent a été enregistré dans le circuit d'alerte municipal." if emergency else
                             ("Votre signalement a été transmis au service compétent." if instance.service_id else "Votre signalement est enregistré et attend son orientation.")),
                )
                CitizenNotification.objects.create(
                    user=citizen, kind=CitizenNotification.Kind.REQUEST,
                    title=(f"Signalement urgent {instance.reference} enregistré" if emergency else f"Signalement {instance.reference} enregistré"),
                    message=("Votre signalement urgent est enregistré. En cas de danger vital immédiat, contactez également les services d'urgence compétents." if emergency else "Votre signalement a bien été pris en compte."),
                    related_request=instance, is_important=emergency,
                )
                return {"reference": instance.reference, "kind": "report", "confirmation": _request_confirmation(instance), "emergency": emergency}

            if intent == "procedure":
                from apps.city.models import CitizenNotification, CitizenRequestEvent
                from apps.city.serializers import CitizenRequestSerializer
                from apps.city.views import _create_request_event, _register_service_usage
                serializer = CitizenRequestSerializer(data=self._clean_procedure(draft), context={"request": request})
                serializer.is_valid(raise_exception=True)
                instance = serializer.save()
                _register_service_usage(instance.service_id)
                _create_request_event(instance, actor=citizen, event_type=CitizenRequestEvent.EventType.CREATED, title="Demande enregistrée", message="Votre demande a été transmise aux services municipaux.")
                CitizenNotification.objects.create(user=citizen, kind=CitizenNotification.Kind.REQUEST, title=f"Demande {instance.reference} enregistrée", message="Votre demande a bien été transmise aux services municipaux.", related_request=instance)
                return {"reference": instance.reference, "kind": "procedure"}

            if intent == "appointment":
                from apps.city.serializers import CitizenAppointmentSerializer
                from apps.city.views import _sync_appointment_reminder
                serializer = CitizenAppointmentSerializer(data=self._clean_appointment(draft), context={"request": request})
                serializer.is_valid(raise_exception=True)
                appointment = serializer.save()
                _sync_appointment_reminder(appointment)
                return {"reference": appointment.reference, "kind": "appointment", "starts_at": str(appointment.starts_at), "agent": appointment.agent.get_full_name().strip() or appointment.agent.email}

            if intent == "contact":
                from apps.city.models import CitizenNotification, ContactMessage
                from apps.city.serializers import ContactMessageCreateSerializer
                from apps.city.views import _register_service_usage
                serializer = ContactMessageCreateSerializer(data=self._clean_contact(draft, citizen), context={"request": request})
                serializer.is_valid(raise_exception=True)
                item = serializer.save()
                _register_service_usage(item.service_id)
                CitizenNotification.objects.create(
                    user=citizen, kind=CitizenNotification.Kind.CONTACT,
                    title=("Préoccupation de confidentialité enregistrée" if item.category == ContactMessage.Category.PRIVACY else "Message transmis à la mairie"),
                    message=f"Votre message {item.reference} a bien été reçu.", related_contact=item,
                    is_important=item.category == ContactMessage.Category.PRIVACY,
                )
                return {"reference": item.reference, "kind": "contact"}

        raise RuntimeError("Action non prise en charge")

    def status(self, reference: str, citizen) -> str:
        self.setup()
        ref = (reference or "").strip().upper()
        if ref.startswith("NT-R"):
            from apps.city.models import CitizenRequest
            obj = CitizenRequest.objects.filter(reference=ref, citizen=citizen).select_related("service").first()
            if not obj:
                return "Dossier introuvable pour ce numéro."
            service = obj.service.name if obj.service else "orientation en cours"
            return f"{obj.reference}: {obj.get_status_display()}. Service: {service}. Priorité: {obj.get_priority_display()}."
        if ref.startswith("NT-A"):
            from apps.city.models import CitizenAppointment
            obj = CitizenAppointment.objects.filter(reference=ref, citizen=citizen).select_related("agent").first()
            if not obj:
                return "Rendez-vous introuvable pour ce numéro."
            return f"{obj.reference}: {obj.get_status_display()}, le {obj.starts_at:%d/%m/%Y %H:%M}, avec {obj.agent.get_full_name().strip() or 'un agent municipal'}."
        if ref.startswith("NT-C"):
            from apps.city.models import ContactMessage
            obj = ContactMessage.objects.filter(reference=ref, user=citizen).first()
            return f"{obj.reference}: {obj.get_status_display()}." if obj else "Message introuvable pour ce numéro."
        return "Référence inconnue. Utilisez une référence NT-R, NT-A ou NT-C."

    def _functional_requirements(self):
        try:
            from apps.city.models import WebCupRequestSnapshot
            rows = WebCupRequestSnapshot.objects.filter(is_visible=True).order_by("sort_order", "external_id").values("request_code", "message_public")[:100]
            return [{"code": row["request_code"], "description": (row["message_public"] or "")[:700]} for row in rows]
        except Exception:
            return []

    @staticmethod
    def _clean_procedure(draft):
        data = {
            "request_type": "procedure",
            "title": draft.get("title") or "",
            "description": draft.get("description") or draft.get("details") or "",
        }
        service = draft.get("service_id") or draft.get("service")
        if service is not None:
            data["service"] = service
        return data

    @staticmethod
    def _clean_report(draft):
        allowed = {"service", "incident_category", "title", "description", "location_text", "latitude", "longitude", "district", "street", "building", "landmark", "location_accuracy", "occurred_at", "frequency", "infrastructure_id", "severity", "danger_present", "people_affected", "impacts_accessibility", "accessibility_details", "allow_contact", "preferred_contact", "contact_phone"}
        data = {k: v for k, v in draft.items() if k in allowed and v not in (None, "")}
        if "service_id" in draft and draft.get("service_id") is not None:
            data["service"] = draft["service_id"]
        return data

    @staticmethod
    def _clean_appointment(draft):
        allowed = {"agent", "service", "starts_at", "ends_at", "reason", "details", "reminder_enabled", "reminder_minutes_before"}
        data = {k: v for k, v in draft.items() if k in allowed and v not in (None, "")}
        if draft.get("agent_id") is not None:
            data["agent"] = draft["agent_id"]
        if draft.get("service_id") is not None:
            data["service"] = draft["service_id"]
        return data

    @staticmethod
    def _clean_contact(draft, citizen):
        service = draft.get("service_id") or draft.get("service")
        return {
            "category": draft.get("category") or "general",
            "name": citizen.get_full_name().strip() or citizen.email.split("@")[0],
            "email": citizen.email,
            "service": service,
            "subject": draft.get("subject") or "Message envoyé par SMS",
            "message": draft.get("message") or draft.get("details") or "",
        }
