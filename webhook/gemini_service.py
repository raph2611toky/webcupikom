import json
import os
import re
from typing import Any


class GeminiService:
    def __init__(self):
        self.api_key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
        self.model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()
        self._client = None

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def _get_client(self):
        if self._client is None:
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    def interpret(self, *, text: str, state: dict, context: dict) -> dict[str, Any]:
        if not self.enabled:
            return self._fallback(text, state)
        schema = {
            "intent": "report|procedure|appointment|contact|status|info|cancel|unknown",
            "slots": {
                "incident_category": "string|null", "title": "string|null", "description": "string|null",
                "location_text": "string|null", "district": "string|null", "street": "string|null",
                "building": "string|null", "landmark": "string|null", "occurred_at": "ISO datetime|null",
                "frequency": "once|recurring|ongoing|null", "severity": "minor|moderate|major|critical|null",
                "danger_present": "boolean|null", "people_affected": "integer|null",
                "impacts_accessibility": "boolean|null", "accessibility_details": "string|null",
                "allow_contact": "boolean|null", "preferred_contact": "platform|email|phone|null",
                "agent_id": "integer|null", "service_id": "integer|null", "starts_at": "ISO datetime|null",
                "ends_at": "ISO datetime|null", "reason": "string|null", "details": "string|null",
                "subject": "string|null", "message": "string|null", "category": "general|privacy|null",
                "reference": "string|null"
            },
            "question": "short SMS question or empty string",
        }
        prompt = f"""
Tu es le moteur de compréhension SMS de Nova Terra. Tu ne crées JAMAIS une donnée et tu ne confirmes JAMAIS une action.
Tu extrais seulement l'intention et les informations explicites ou raisonnablement déductibles du SMS.
Réponds uniquement en JSON valide suivant ce schéma: {json.dumps(schema, ensure_ascii=False)}

Règles:
- report = signalement municipal, y compris urgence, panne, danger, déchets, voirie, eau, énergie, sécurité.
- procedure = démarche/demande administrative municipale hors signalement.
- appointment = prise de rendez-vous avec un agent/service municipal.
- contact = message au conseil/mairie, confidentialité, demande de contact générale.
- status = suivi d'un dossier/rendez-vous existant avec référence NT-R/NT-A/NT-C.
- info = question informative sur Nova Terra ou un service.
- Ne fabrique pas de date, lieu, agent, service ou référence.
- Pour un signalement, crée un titre bref depuis le problème si possible et garde une description fidèle.
- danger_present=true seulement si le texte décrit un danger réel/imminent.
- Si l'utilisateur donne une heure de début et une durée, calcule ends_at; sinon ne l'invente pas.
- Les IDs disponibles sont ceux du contexte uniquement.

Etat actuel: {json.dumps(state, ensure_ascii=False, default=str)}
Contexte Nova Terra: {json.dumps(context, ensure_ascii=False, default=str)}
SMS: {text}
""".strip()
        try:
            from google.genai import types
            response = self._get_client().models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                    max_output_tokens=1200,
                ),
            )
            data = json.loads(response.text or "{}")
            if not isinstance(data, dict):
                return self._fallback(text, state)
            data.setdefault("slots", {})
            return data
        except Exception:
            return self._fallback(text, state)

    def answer_info(self, *, text: str, context: dict) -> str:
        if not self.enabled:
            return "Je peux vous aider pour un signalement, un rendez-vous, un message à la mairie ou le suivi d'un dossier."
        prompt = f"""
Tu es l'assistant SMS Nova Terra. Réponds en français, précisément et en moins de 450 caractères.
N'invente aucune information. Utilise seulement le contexte ci-dessous. Si l'information manque, dis-le.
Contexte: {json.dumps(context, ensure_ascii=False, default=str)}
Question: {text}
""".strip()
        try:
            response = self._get_client().models.generate_content(model=self.model, contents=prompt)
            return (response.text or "").strip()
        except Exception:
            return "Service IA momentanément indisponible. Envoyez AIDE pour voir les actions disponibles."

    def _fallback(self, text: str, state: dict) -> dict[str, Any]:
        low = text.lower().strip()
        if low in {"annuler", "stop", "cancel"}:
            return {"intent": "cancel", "slots": {}}
        ref = re.search(r"\bNT-[RAC]-[A-Z0-9-]+\b", text, re.I)
        if ref:
            return {"intent": "status", "slots": {"reference": ref.group(0).upper()}}
        report_words = ("signal", "signaler", "panne", "danger", "incend", "fuite", "déchet", "dechet", "route", "lampadaire", "urgence")
        if any(w in low for w in report_words):
            return {"intent": "report", "slots": {"description": text, "title": text[:120]}}
        if "démarche" in low or "demarche" in low or "demande administrative" in low:
            return {"intent": "procedure", "slots": {"description": text}}
        if "rendez" in low or "rdv" in low:
            return {"intent": "appointment", "slots": {}}
        if "mairie" in low or "conseil" in low or "message" in low:
            return {"intent": "contact", "slots": {"message": text}}
        return {"intent": state.get("intent") or "unknown", "slots": {}}
