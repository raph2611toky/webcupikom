"""Orientation citoyenne automatisée — D10 / F91 / F92.

Le moteur est volontairement local et déterministe : il ne fabrique jamais de
service. Il classe uniquement les services municipaux présents en base et les
catégories de signalement effectivement supportées par le backend.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher

from ..models import MunicipalService
from .reports import CATEGORIES


STOPWORDS = {
    "a", "ai", "au", "aux", "avec", "ce", "ces", "dans", "de", "des", "du",
    "elle", "en", "est", "et", "faire", "fait", "il", "je", "j", "la", "le",
    "les", "mais", "me", "mes", "mon", "ne", "nous", "ou", "par", "pas",
    "pour", "que", "qui", "sa", "se", "ses", "son", "sur", "un", "une",
    "veut", "veux", "voudrais", "besoin", "probleme", "problème",
    "and", "a", "an", "the", "to", "of", "for", "with", "my", "i", "is",
    "are", "in", "on", "at", "please", "need", "want", "problem",
    "municipal", "municipale", "municipales", "municipaux", "service", "services",
    "ville", "city", "public", "publique", "rue", "street",
}

# Enrichit les données dynamiques sans imposer de nouveaux services en base.
SERVICE_HINTS = {
    "administration": [
        "papier", "papiers", "document", "documents", "identite", "identité",
        "carte", "acte", "naissance", "certificat", "etat civil", "état civil",
        "inscription", "dossier", "mairie", "lost papers", "identity", "certificate",
        "birth certificate", "registration",
    ],
    "transport": [
        "bus", "horaire", "horaires", "mobilite", "mobilité", "deplacement",
        "déplacement", "circulation", "transport", "route", "voirie", "chaussée",
        "road", "traffic", "schedule", "mobility",
    ],
    "sante": [
        "sante", "santé", "medecin", "médecin", "docteur", "hopital", "hôpital",
        "clinique", "soin", "soins", "malade", "health", "doctor", "hospital",
        "clinic", "medical care",
    ],
    "habitat": [
        "logement", "maison", "habitat", "residence", "résidence", "loyer",
        "locataire", "proprietaire", "propriétaire", "housing", "home", "rent",
    ],
    "energie": [
        "energie", "énergie", "electricite", "électricité", "courant", "lumiere",
        "lumière", "eclairage", "éclairage", "lampadaire", "lampe", "poteau",
        "power", "electricity", "light", "lighting", "street light",
    ],
    "securite": [
        "securite", "sécurité", "danger", "agression", "vol", "police", "incendie",
        "feu", "safety", "danger", "assault", "theft", "fire",
    ],
    "environnement": [
        "dechet", "déchet", "dechets", "déchets", "proprete", "propreté", "ordure",
        "ordures", "arbre", "parc", "environnement", "waste", "trash", "tree", "park",
    ],
    "eau": [
        "eau", "fuite", "canalisation", "robinet", "water", "leak", "pipe",
    ],
}

CATEGORY_HINTS = {
    "street_lighting": [
        "lampadaire", "lampe", "lumiere", "lumière", "eclairage", "éclairage",
        "poteau lumineux", "rue sombre", "fait noir", "street light", "streetlight",
        "lighting", "dark street", "broken light",
    ],
    "road_damage": [
        "nid de poule", "nid-de-poule", "route cassee", "route cassée", "chaussee",
        "chaussée", "trou route", "voirie", "pothole", "damaged road", "road damage",
    ],
    "waste": [
        "dechet", "déchet", "dechets", "déchets", "ordure", "ordures", "poubelle",
        "proprete", "propreté", "waste", "trash", "garbage",
    ],
    "water_leak": [
        "fuite eau", "fuite d eau", "canalisation", "eau coule", "water leak",
        "leaking pipe", "pipe leak",
    ],
    "green_spaces": [
        "arbre", "branche", "parc", "jardin", "espace vert", "espaces verts",
        "tree", "branch", "park", "green space",
    ],
    "accessibility": [
        "accessibilite", "accessibilité", "fauteuil", "rampe", "trottoir inaccessible",
        "wheelchair", "accessibility", "ramp",
    ],
    "public_safety": [
        "insecurite", "insécurité", "danger rue", "zone dangereuse", "securite publique",
        "sécurité publique", "unsafe", "public safety",
    ],
    "medical_emergency": [
        "urgence medicale", "urgence médicale", "ne respire plus", "inconscient",
        "inconsciente", "malaise grave", "saigne beaucoup", "medical emergency",
        "not breathing", "unconscious", "severe bleeding",
    ],
    "fire_emergency": [
        "incendie", "depart de feu", "départ de feu", "maison en feu", "feu",
        "fire", "burning", "on fire",
    ],
    "immediate_danger": [
        "danger immediat", "danger immédiat", "vie en danger", "menace immediate",
        "menace immédiate", "immediate danger", "life in danger",
    ],
    "building": [
        "batiment", "bâtiment", "equipement municipal", "équipement municipal",
        "mur", "toit", "building", "municipal building",
    ],
}

REPORT_CONTEXT_WORDS = {
    "casse", "cassé", "cassee", "cassée", "panne", "signaler", "signalement",
    "fuite", "trou", "abime", "abîmé", "endommagé", "endommage", "ne fonctionne",
    "marche plus", "eteint", "éteint", "broken", "damaged", "report", "leak",
    "not working", "does not work", "outage",
}

URGENT_WORDS = {
    "urgent", "urgence", "immediat", "immédiat", "immediate", "danger", "grave",
    "critique", "critical", "secours", "help", "vite", "rapidement",
}


@dataclass(frozen=True)
class RankedCandidate:
    kind: str
    key: str
    label: str
    score: float
    service: MunicipalService | None = None
    category: dict | None = None
    emergency: bool = False


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.casefold().replace("’", "'")
    value = re.sub(r"[^a-z0-9'\s-]+", " ", value)
    value = value.replace("'", " ").replace("-", " ")
    return re.sub(r"\s+", " ", value).strip()


def _tokens(value: str) -> list[str]:
    return [token for token in normalize_text(value).split() if len(token) > 1 and token not in STOPWORDS]


def _unique(values):
    seen = set()
    result = []
    for value in values:
        norm = normalize_text(value)
        if norm and norm not in seen:
            seen.add(norm)
            result.append(value)
    return result


def _candidate_score(message: str, phrases: list[str]) -> float:
    """Score robuste aux formulations longues et aux fautes légères."""
    norm_message = normalize_text(message)
    query_tokens = _tokens(message)
    if not query_tokens:
        return 0.0

    normalized_phrases = [normalize_text(value) for value in phrases if normalize_text(value)]
    candidate_tokens = set()
    for phrase in normalized_phrases:
        candidate_tokens.update(_tokens(phrase))

    exact_phrase = 0.0
    query_token_set = set(query_tokens)
    for phrase in normalized_phrases:
        phrase_tokens = _tokens(phrase)
        if not phrase_tokens:
            continue
        if len(phrase_tokens) == 1:
            matched = phrase_tokens[0] in query_token_set
        else:
            matched = f" {phrase} " in f" {norm_message} "
        if matched:
            # Plus la phrase est spécifique, plus le signal est fort.
            exact_phrase = max(exact_phrase, min(1.0, 0.55 + (len(phrase_tokens) * 0.12)))

    # Similarité mot-à-mot : utile pour « lampadair », « horraires », « buss »,
    # tout en exigeant plusieurs signaux lorsqu'une phrase contient plusieurs mots.
    qualities = []
    for token in query_tokens:
        best = max(
            (SequenceMatcher(None, token, candidate).ratio() for candidate in candidate_tokens),
            default=0.0,
        )
        if best >= 0.80:
            qualities.append(best)
    qualities.sort(reverse=True)
    if qualities:
        top_qualities = qualities[:3]
        average_quality = sum(top_qualities) / len(top_qualities)
        expected = min(3, len(query_tokens))
        coverage = min(1.0, len(top_qualities) / max(1, expected))
        token_signal = average_quality * (0.55 + (0.45 * coverage))
    else:
        token_signal = 0.0

    whole_ratio = max(
        (SequenceMatcher(None, norm_message, phrase).ratio() for phrase in normalized_phrases),
        default=0.0,
    )

    score = max(exact_phrase, (token_signal * 0.68) + (whole_ratio * 0.08))
    return max(0.0, min(score, 1.0))


def _contains_any(message: str, phrases) -> bool:
    normalized = normalize_text(message)
    padded = f" {normalized} "
    for phrase in phrases:
        norm = normalize_text(phrase)
        if norm and (norm in normalized or f" {norm} " in padded):
            return True
    return False


def _service_phrases(service: MunicipalService, language: str) -> list[str]:
    translations = service.translations or {}
    translated = translations.get(language) or {}
    values = [
        service.name,
        service.slug,
        service.category,
        service.short_description,
        service.description,
        *list(service.actions or []),
        *SERVICE_HINTS.get(service.slug, []),
    ]
    if language != "fr":
        for field in ("name", "category", "short_description", "description"):
            value = translated.get(field)
            if isinstance(value, str):
                values.append(value)
        actions = translated.get("actions")
        if isinstance(actions, list):
            values.extend(str(item) for item in actions)
    return _unique(str(value) for value in values if value)


def _category_phrases(category: dict) -> list[str]:
    return _unique([
        category.get("label", ""),
        category.get("code", ""),
        *(category.get("aliases") or []),
        *CATEGORY_HINTS.get(category.get("code"), []),
    ])


def _emergency_override(message: str):
    norm = normalize_text(message)
    medical = _contains_any(norm, CATEGORY_HINTS["medical_emergency"] + ["medecin", "docteur", "medical", "blessure"])
    fire = _contains_any(norm, CATEGORY_HINTS["fire_emergency"])
    danger = _contains_any(norm, CATEGORY_HINTS["immediate_danger"])
    urgent = _contains_any(norm, URGENT_WORDS)

    if fire:
        return "fire_emergency"
    if danger:
        return "immediate_danger"
    if medical and urgent:
        return "medical_emergency"
    # Signaux médicaux vitaux suffisamment explicites, même sans le mot urgence.
    if _contains_any(norm, ["ne respire plus", "not breathing", "inconscient", "unconscious", "saigne beaucoup", "severe bleeding"]):
        return "medical_emergency"
    return None


def rank_orientation(message: str, *, language: str = "fr") -> list[RankedCandidate]:
    services = list(MunicipalService.objects.all().order_by("sort_order", "name"))
    service_by_slug = {service.slug: service for service in services}
    candidates: list[RankedCandidate] = []

    emergency_code = _emergency_override(message)
    report_context = _contains_any(message, REPORT_CONTEXT_WORDS)

    for category in CATEGORIES:
        code = category["code"]
        if code == "other":
            continue
        score = _candidate_score(message, _category_phrases(category))
        emergency = category.get("alerting") == "emergency"
        if emergency_code == code:
            score = max(score, 0.99)
        elif emergency:
            # Une urgence ne doit pas être proposée sur un vague mot isolé.
            score *= 0.72
        elif report_context and score > 0:
            score = min(1.0, score + 0.16)
        elif not report_context:
            score *= 0.82

        service = service_by_slug.get(category.get("service_slug"))
        if score >= 0.12:
            candidates.append(RankedCandidate(
                kind="report",
                key=code,
                label=category["label"],
                score=score,
                service=service,
                category=category,
                emergency=emergency,
            ))

    for service in services:
        score = _candidate_score(message, _service_phrases(service, language))
        if service.is_featured:
            score = min(1.0, score + 0.01)
        if not service.is_active:
            score *= 0.90
        # Si le texte décrit clairement un incident, la catégorie de signalement
        # correspondante doit devancer la simple fiche service.
        if report_context:
            score *= 0.86
        if score >= 0.10:
            candidates.append(RankedCandidate(
                kind="service",
                key=service.slug,
                label=service.name,
                score=score,
                service=service,
            ))

    candidates.sort(key=lambda item: (-item.score, 0 if item.kind == "report" else 1, item.label))
    return candidates


def _service_payload(service: MunicipalService | None):
    if service is None:
        return None
    return {
        "id": service.pk,
        "slug": service.slug,
        "name": service.name,
        "category": service.category,
        "short_description": service.short_description,
        "is_available": service.is_active,
        "availability_status": service.availability_status,
        "next_action": service.alternative_action if not service.is_active else "",
        "actions": service.actions or [],
    }


def _candidate_payload(candidate: RankedCandidate, *, language: str):
    confidence = round(candidate.score, 2)
    if candidate.kind == "report":
        action = "create_report"
        route = f"/citizen/reports/new?category={candidate.key}"
        intent = f"signalement_{candidate.key}"
        explanation = (
            f"Votre demande semble concerner « {candidate.label} »."
            if language == "fr"
            else f"Your request appears to concern “{candidate.label}”."
        )
    else:
        action = "view_service"
        route = f"/services/{candidate.key}"
        intent = f"service_{candidate.key.replace('-', '_')}"
        explanation = (
            f"Le service « {candidate.label} » semble le plus adapté à votre besoin."
            if language == "fr"
            else f"The “{candidate.label}” service appears to be the best match for your need."
        )

    return {
        "intent": intent,
        "type": candidate.kind,
        "category": candidate.key if candidate.kind == "report" else None,
        "recommended_service": _service_payload(candidate.service),
        "action": action,
        "route": route,
        "confidence": confidence,
        "explanation": explanation,
        "emergency": candidate.emergency,
    }


def orient_citizen(message: str, *, language: str = "fr", max_suggestions: int = 3) -> dict:
    ranked = rank_orientation(message, language=language)
    top = ranked[0] if ranked else None

    if top is None or top.score < 0.24:
        # Fallback volontaire : jamais de fausse certitude. On propose des services
        # existants et laisse l'habitant choisir.
        services = list(MunicipalService.objects.filter(is_active=True).order_by(
            "priority_order", "sort_order", "name"
        )[:max_suggestions])
        suggestions = [
            {
                "intent": f"service_{service.slug.replace('-', '_')}",
                "type": "service",
                "category": None,
                "recommended_service": _service_payload(service),
                "action": "view_service",
                "route": f"/services/{service.slug}",
                "confidence": 0.0,
                "explanation": (
                    "Service proposé pour vous laisser choisir."
                    if language == "fr"
                    else "Suggested service so you can choose."
                ),
                "emergency": False,
            }
            for service in services
        ]
        return {
            "intent": "unknown",
            "type": "suggestions",
            "category": None,
            "recommended_service": None,
            "action": "choose_suggestion",
            "route": None,
            "confidence": round(top.score, 2) if top else 0.0,
            "needs_confirmation": True,
            "explanation": (
                "Je ne suis pas suffisamment sûr pour choisir à votre place. Voici les pistes les plus pertinentes."
                if language == "fr"
                else "I am not confident enough to choose for you. Here are the most relevant options."
            ),
            "emergency": False,
            "suggestions": suggestions,
            "language": language,
            "engine": "local_hybrid_v1",
        }

    primary = _candidate_payload(top, language=language)
    # Entre 0.24 et 0.49, le résultat reste utile mais exige confirmation.
    needs_confirmation = top.score < 0.50
    alternatives = []
    seen = {(top.kind, top.key)}
    for candidate in ranked[1:]:
        marker = (candidate.kind, candidate.key)
        if marker in seen:
            continue
        # N'affiche pas d'alternative quasi sans rapport.
        if candidate.score < max(0.18, top.score * 0.45):
            continue
        alternatives.append(_candidate_payload(candidate, language=language))
        seen.add(marker)
        if len(alternatives) >= max_suggestions:
            break

    return {
        **primary,
        "needs_confirmation": needs_confirmation,
        "suggestions": alternatives,
        "language": language,
        "engine": "local_hybrid_v1",
    }
