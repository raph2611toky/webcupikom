"""Heuristique locale de détection de signalements similaires (F75).

Le calcul reste volontairement explicable et sans dépendance externe/IA : il
combine texte, catégorie, service, quartier et proximité géographique. Le
résultat sert d'aide à l'agent ; le lien ``duplicate_of`` reste une décision
humaine explicite.
"""

from __future__ import annotations

from difflib import SequenceMatcher
from math import asin, cos, radians, sin, sqrt
import re
import unicodedata

from django.db.models import Q

from ..models import CitizenRequest


_STOP_WORDS = {
    "alors", "apres", "avec", "avoir", "cette", "dans", "des", "du", "elle",
    "est", "etre", "fait", "faire", "ici", "les", "leur", "mais", "mes", "mon",
    "nous", "notre", "pour", "plus", "que", "qui", "sans", "ses", "son", "sur",
    "une", "vous", "votre", "aux", "par", "pas", "tout", "tres", "comme", "cela",
}


def _normalized_text(value: str | None) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch)).casefold()
    return " ".join(re.findall(r"[a-z0-9]+", value))


def _tokens(value: str | None) -> set[str]:
    return {
        token for token in _normalized_text(value).split()
        if len(token) >= 3 and token not in _STOP_WORDS
    }


def _text_similarity(left: str | None, right: str | None) -> float:
    left_norm, right_norm = _normalized_text(left), _normalized_text(right)
    if not left_norm or not right_norm:
        return 0.0
    left_tokens, right_tokens = _tokens(left_norm), _tokens(right_norm)
    union = left_tokens | right_tokens
    jaccard = (len(left_tokens & right_tokens) / len(union)) if union else 0.0
    sequence = SequenceMatcher(None, left_norm[:2000], right_norm[:2000]).ratio()
    # Les mots communs sont plus importants que l'ordre exact de la phrase.
    return min(1.0, (jaccard * 0.7) + (sequence * 0.3))


def _same_text(left: str | None, right: str | None) -> bool:
    return bool(left and right and _normalized_text(left) == _normalized_text(right))


def _distance_meters(left: CitizenRequest, right: CitizenRequest) -> float | None:
    if None in (left.latitude, left.longitude, right.latitude, right.longitude):
        return None
    lat1, lon1 = radians(float(left.latitude)), radians(float(left.longitude))
    lat2, lon2 = radians(float(right.latitude)), radians(float(right.longitude))
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 6_371_000 * 2 * asin(sqrt(min(1.0, a)))


def _location_score(distance: float | None) -> float:
    if distance is None:
        return 0.0
    if distance <= 100:
        return 1.0
    if distance <= 300:
        return 0.9
    if distance <= 750:
        return 0.7
    if distance <= 2_000:
        return 0.45
    if distance <= 5_000:
        return 0.2
    return 0.0


def _score_pair(source: CitizenRequest, candidate: CitizenRequest) -> dict:
    weighted = []
    reasons = []

    def add(weight: float, score: float, reason: str | None = None, *, reason_at: float = 0.75):
        weighted.append((weight, max(0.0, min(1.0, score))))
        if reason and score >= reason_at:
            reasons.append(reason)

    title_score = _text_similarity(source.title, candidate.title)
    add(0.24, title_score, "Titre proche", reason_at=0.58)

    description_score = _text_similarity(source.description, candidate.description)
    add(0.22, description_score, "Description proche", reason_at=0.52)

    if source.incident_category and candidate.incident_category:
        add(
            0.15,
            1.0 if _same_text(source.incident_category, candidate.incident_category) else 0.0,
            "Même catégorie",
        )
    if source.service_id and candidate.service_id:
        add(0.10, 1.0 if source.service_id == candidate.service_id else 0.0, "Même service")
    if source.district and candidate.district:
        add(0.10, 1.0 if _same_text(source.district, candidate.district) else 0.0, "Même quartier")
    if source.location_text and candidate.location_text:
        location_text_score = _text_similarity(source.location_text, candidate.location_text)
        add(0.07, location_text_score, "Lieu similaire", reason_at=0.6)
    if source.infrastructure_id and candidate.infrastructure_id:
        add(
            0.05,
            1.0 if _same_text(source.infrastructure_id, candidate.infrastructure_id) else 0.0,
            "Même équipement/infrastructure",
        )

    distance = _distance_meters(source, candidate)
    if distance is not None:
        proximity = _location_score(distance)
        add(0.12, proximity, "Très proche géographiquement", reason_at=0.7)

    total_weight = sum(weight for weight, _ in weighted)
    score = sum(weight * value for weight, value in weighted) / total_weight if total_weight else 0.0

    # Un doublon déjà explicitement relié doit remonter immédiatement dans le panneau.
    if source.duplicate_of_id == candidate.pk or candidate.duplicate_of_id == source.pk:
        score = max(score, 0.99)
        reasons.insert(0, "Déjà lié comme doublon")

    return {
        "score": round(score, 4),
        "similarity_percent": int(round(score * 100)),
        "reasons": list(dict.fromkeys(reasons)),
        "distance_meters": round(distance, 1) if distance is not None else None,
    }


def _candidate_queryset(source: CitizenRequest):
    queryset = (
        CitizenRequest.objects.filter(request_type=CitizenRequest.RequestType.REPORT)
        .exclude(pk=source.pk)
        .select_related("service", "citizen", "duplicate_of")
    )

    # Préfiltrage SQL large pour ne pas comparer toute l'histoire de la ville.
    hints = Q()
    if source.incident_category:
        hints |= Q(incident_category__iexact=source.incident_category)
    if source.service_id:
        hints |= Q(service_id=source.service_id)
    if source.district:
        hints |= Q(district__iexact=source.district)
    if source.infrastructure_id:
        hints |= Q(infrastructure_id__iexact=source.infrastructure_id)

    if hints:
        # Les liens de doublon existants doivent rester visibles même s'ils ne
        # correspondent plus aux métadonnées actuelles du dossier.
        if source.duplicate_of_id:
            hints |= Q(pk=source.duplicate_of_id)
        hints |= Q(duplicate_of_id=source.pk)
        queryset = queryset.filter(hints)
    elif source.duplicate_of_id:
        queryset = queryset.filter(Q(pk=source.duplicate_of_id) | Q(duplicate_of_id=source.pk))
    return queryset.order_by("-created_at", "-pk")[:300]


def find_similar_requests(source: CitizenRequest, *, limit: int = 8, min_score: float = 0.42) -> list[dict]:
    """Retourne les meilleurs candidats explicables pour un signalement.

    ``min_score`` n'est qu'un seuil de suggestion. Aucune relation de doublon
    n'est créée ici : l'agent doit toujours confirmer via ``duplicate_of``.
    """
    if source.request_type != CitizenRequest.RequestType.REPORT:
        return []

    matches = []
    for candidate in _candidate_queryset(source):
        metrics = _score_pair(source, candidate)
        if metrics["score"] < min_score:
            continue
        matches.append({
            "id": candidate.pk,
            "reference": candidate.reference,
            "title": candidate.title,
            "description_excerpt": (candidate.description or "")[:280],
            "status": candidate.status,
            "status_label": candidate.get_status_display(),
            "priority": candidate.priority,
            "incident_category": candidate.incident_category,
            "district": candidate.district,
            "service_id": candidate.service_id,
            "service_name": candidate.service.name if candidate.service_id else None,
            "created_at": candidate.created_at,
            "duplicate_of": candidate.duplicate_of_id,
            "duplicate_of_reference": candidate.duplicate_of.reference if candidate.duplicate_of_id else None,
            **metrics,
        })

    matches.sort(key=lambda item: (-item["score"], -item["created_at"].timestamp(), -item["id"]))
    return matches[:limit]
