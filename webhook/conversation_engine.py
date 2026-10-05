import json
import os
import re
from datetime import datetime


CONFIRM_WORDS = {"confirmer", "confirme", "confirm", "oui confirmer", "oui je confirme"}
CANCEL_WORDS = {"annuler", "annule", "stop", "cancel", "recommencer", "reset"}
HELP_WORDS = {"aide", "help", "menu", "bonjour", "salama"}


class ConversationEngine:
    def __init__(self, *, store, bridge, gemini):
        self.store = store
        self.bridge = bridge
        self.gemini = gemini
        self.max_reply = int(os.getenv("SMS_AI_MAX_REPLY_CHARS", "700"))

    def process(self, *, phone: str, text: str, client_reference: str = "") -> str:
        cached = self.store.get_processed(client_reference)
        if cached is not None:
            return cached
        clean = (text or "").strip()
        low = re.sub(r"\s+", " ", clean.lower())
        if not clean:
            return self._done(client_reference, phone, "SMS vide. Envoyez AIDE pour commencer.")

        citizen = self.bridge.find_citizen(phone)
        if not citizen:
            return self._done(client_reference, phone, "Ce numéro n'est pas lié à un compte citoyen Nova Terra actif. Ajoutez/vérifiez votre téléphone dans votre profil avant d'utiliser le service SMS.")

        if low in HELP_WORDS:
            self.store.reset(phone)
            return self._done(client_reference, phone, "Nova Terra SMS: vous pouvez signaler un problème, faire une démarche, prendre un rendez-vous, écrire à la mairie/conseil ou suivre NT-R/NT-A/NT-C. Décrivez simplement votre besoin. Envoyez ANNULER pour recommencer.")
        if low in CANCEL_WORDS:
            self.store.reset(phone)
            return self._done(client_reference, phone, "Conversation annulée. Décrivez votre nouveau besoin quand vous voulez.")

        state = self.store.get(phone)
        if state.get("phase") == "confirm" and low in CONFIRM_WORDS:
            return self._confirm(phone, state, citizen, client_reference)

        context = self.bridge.context(citizen)
        parsed = self.gemini.interpret(text=clean, state=state, context=context)
        intent = parsed.get("intent") or state.get("intent") or "unknown"
        if intent == "cancel":
            self.store.reset(phone)
            return self._done(client_reference, phone, "Conversation annulée.")
        if intent == "info":
            reply = self.gemini.answer_info(text=clean, context=context)
            return self._done(client_reference, phone, reply)
        if intent == "status":
            reference = (parsed.get("slots") or {}).get("reference") or state.get("draft", {}).get("reference")
            if not reference:
                reply = "Indiquez la référence à suivre, par exemple NT-R-..., NT-A-... ou NT-C-...."
            else:
                reply = self.bridge.status(reference, citizen)
            return self._done(client_reference, phone, reply)
        if intent not in {"report", "procedure", "appointment", "contact"}:
            reply = "Je n'ai pas identifié l'action. Dites par exemple: « Je veux signaler... », « Je veux faire une démarche... », « Je veux un rendez-vous... » ou « Je veux écrire à la mairie... »"
            return self._done(client_reference, phone, reply)

        if state.get("intent") and state["intent"] != intent and state.get("phase") != "idle":
            state = self.store.empty_state()
        state["intent"] = intent
        draft = dict(state.get("draft") or {})
        for key, value in (parsed.get("slots") or {}).items():
            if value not in (None, ""):
                draft[key] = value
        # Conserver le texte comme contenu utile si Gemini a reconnu le type sans remplir le champ principal.
        if intent == "report" and not draft.get("description"):
            draft["description"] = clean
        if intent == "contact" and not draft.get("message"):
            draft["message"] = clean
        state["draft"] = draft

        validation = self.bridge.validate(intent, draft, citizen)
        state["validation"] = self._jsonable(validation.get("errors", {}))
        if validation.get("valid"):
            state["phase"] = "confirm"
            self.store.save(phone, state)
            reply = self._confirmation_summary(intent, draft, context)
            return self._done(client_reference, phone, reply)

        state["phase"] = "collect"
        self.store.save(phone, state)
        reply = self._next_question(intent, validation.get("errors", {}), draft, context, parsed.get("question"))
        return self._done(client_reference, phone, reply)

    def _confirm(self, phone, state, citizen, client_reference):
        try:
            result = self.bridge.execute(state["intent"], state["draft"], citizen)
            ref = result["reference"]
            emergency = result.get("emergency", False)
            self.store.reset(phone)
            if result["kind"] == "report":
                reply = f"Signalement enregistré: {ref}."
                if emergency:
                    reply += " Circuit d'urgence municipal activé. En cas de danger vital immédiat, contactez aussi les services d'urgence compétents."
            elif result["kind"] == "procedure":
                reply = f"Demande enregistrée avec succès: {ref}. Vous pourrez suivre son statut avec cette référence."
            elif result["kind"] == "appointment":
                reply = f"Rendez-vous demandé avec succès: {ref}. Vous pourrez suivre son statut avec cette référence."
            else:
                reply = f"Message transmis avec succès: {ref}."
            return self._done(client_reference, phone, reply)
        except Exception as exc:
            # Ne pas perdre le brouillon : l'utilisateur peut corriger ou réessayer.
            state["phase"] = "collect"
            self.store.save(phone, state)
            return self._done(client_reference, phone, f"Impossible de valider pour le moment: {self._compact_error(exc)}. Corrigez l'information ou renvoyez votre demande.")

    def _confirmation_summary(self, intent, draft, context):
        if intent == "report":
            title = draft.get("title") or "Signalement"
            loc = draft.get("location_text") or draft.get("street") or draft.get("district") or "lieu indiqué"
            sev = draft.get("severity") or "modéré"
            warning = " Si un danger vital est immédiat, contactez aussi les services d'urgence compétents." if (draft.get("danger_present") is True or draft.get("severity") == "critical" or draft.get("incident_category") in {"medical_emergency", "fire_emergency", "immediate_danger"}) else ""
            return f"Prêt à enregistrer le signalement « {title} » à {loc} (gravité: {sev}). Répondez CONFIRMER pour l'enregistrer, ou envoyez une correction.{warning}"
        if intent == "procedure":
            service = self._service_name(context.get("services", []), draft.get("service_id")) or "service municipal"
            return f"Prêt à enregistrer la démarche « {draft.get('title') or 'Demande'} » auprès de {service}. Répondez CONFIRMER ou envoyez une correction."
        if intent == "appointment":
            agent = self._name_by_id(context.get("agents", []), draft.get("agent_id")) or f"agent #{draft.get('agent_id')}"
            return f"Prêt à demander le rendez-vous avec {agent}, début {draft.get('starts_at')}, fin {draft.get('ends_at')}, motif: {draft.get('reason')}. Répondez CONFIRMER ou envoyez une correction."
        return f"Prêt à transmettre à la mairie: {draft.get('subject') or 'Message SMS'} — {draft.get('message','')[:220]}. Répondez CONFIRMER ou envoyez une correction."

    def _next_question(self, intent, errors, draft, context, gemini_question=""):
        flat = self._flatten_errors(errors)
        # Questions déterministes pour les champs métier importants.
        if intent == "report":
            if not draft.get("description") or "description" in flat:
                return "Décrivez précisément le problème constaté."
            if not (draft.get("location_text") or (draft.get("latitude") is not None and draft.get("longitude") is not None)) or "location_text" in flat:
                return "Où se situe exactement le problème? Indiquez rue/quartier, bâtiment ou point de repère."
            if not draft.get("title") or "title" in flat:
                return "Donnez un titre court au signalement (ex: fuite d'eau devant l'école)."
            if "occurred_at" in flat:
                return "Quand avez-vous observé le problème? Donnez une date/heure passée."
            if "contact_phone" in flat:
                return "Quel numéro de téléphone peut être utilisé pour vous recontacter?"
            if flat:
                return f"Il manque/corrigez: {', '.join(flat[:4])}. {self._first_error(errors)}"
        if intent == "procedure":
            if not draft.get("service_id") or "service" in flat:
                services = ", ".join(f"{x['id']}={x['name']}" for x in context.get("services", [])[:6] if x.get("is_active"))
                return f"Quel service concerne votre démarche? {services}" if services else "Précisez le service municipal concerné."
            if not draft.get("description") or "description" in flat:
                return "Décrivez votre démarche ou votre demande administrative."
            if not draft.get("title") or "title" in flat:
                return "Donnez un titre court à votre demande."
            if flat:
                return f"La demande n'est pas encore valide: {self._first_error(errors)}"
        if intent == "appointment":
            if not draft.get("agent_id") or "agent" in flat:
                agents = ", ".join(f"{a['id']}={a['name']}" for a in context.get("agents", [])[:5])
                return f"Avec quel agent souhaitez-vous un rendez-vous? {agents}" if agents else "Aucun agent municipal actif n'est disponible actuellement."
            if not draft.get("starts_at") or "starts_at" in flat:
                return "Quelle date et heure souhaitez-vous pour le début du rendez-vous?"
            if not draft.get("ends_at") or "ends_at" in flat:
                return "À quelle heure le rendez-vous doit-il se terminer?"
            if not draft.get("reason") or "reason" in flat:
                return "Quel est le motif du rendez-vous?"
            if flat:
                return f"Le rendez-vous n'est pas encore valide: {self._first_error(errors)}"
        if intent == "contact":
            if not draft.get("message") or "message" in flat:
                return "Quel message souhaitez-vous transmettre à la mairie ou au conseil municipal?"
            if "subject" in flat:
                return "Quel est l'objet de votre message?"
            if flat:
                return f"Le message n'est pas encore valide: {self._first_error(errors)}"
        return gemini_question or "Précisez votre demande."

    def _done(self, client_reference, phone, reply):
        reply = re.sub(r"\s+", " ", str(reply)).strip()
        if len(reply) > self.max_reply:
            reply = reply[: self.max_reply - 1].rstrip() + "…"
        self.store.mark_processed(client_reference, phone, reply)
        return reply

    @staticmethod
    def _flatten_errors(errors):
        if hasattr(errors, "keys"):
            return [str(k) for k in errors.keys()]
        return []

    @staticmethod
    def _first_error(errors):
        try:
            for value in errors.values():
                if isinstance(value, (list, tuple)) and value:
                    return str(value[0])
                if isinstance(value, dict):
                    return ConversationEngine._first_error(value)
                return str(value)
        except Exception:
            pass
        return "Vérifiez les informations envoyées."

    @staticmethod
    def _compact_error(exc):
        text = re.sub(r"\s+", " ", str(exc)).strip()
        return text[:240] or "erreur interne"

    @staticmethod
    def _service_name(rows, value):
        try:
            value = int(value)
        except Exception:
            return None
        for row in rows:
            if int(row.get("id")) == value:
                return row.get("name")
        return None

    @staticmethod
    def _name_by_id(rows, value):
        try:
            value = int(value)
        except Exception:
            return None
        for row in rows:
            if int(row.get("id")) == value:
                return row.get("name")
        return None

    @staticmethod
    def _jsonable(value):
        try:
            return json.loads(json.dumps(value, default=str))
        except Exception:
            return {"detail": str(value)}
