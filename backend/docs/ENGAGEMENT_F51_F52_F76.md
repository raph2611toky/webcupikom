# Engagement citoyen sécurisé — F51 / F52 / F76

Ce correctif complète trois besoins sans mélanger les domaines déjà existants.

## F52 — soutenir une demande d'un autre citoyen

Le soutien F52 concerne les **signalements citoyens** (`CitizenRequest.request_type=report`) et reste distinct de `ProjectSupport` utilisé pour les projets municipaux.

### Endpoints citoyen

- `GET /api/citizen/supportable-requests/`
- `GET /api/citizen/requests/{reference}/support/`
- `POST /api/citizen/requests/{reference}/support/`
- `DELETE /api/citizen/requests/{reference}/support/`

La liste publique est volontairement minimisée. Elle n'expose pas l'identité du déposant, son email, son téléphone, sa description complète, sa rue, son bâtiment, ses coordonnées GPS, ses pièces jointes ni son historique.

Règles :

- authentification citoyen obligatoire ;
- impossible de soutenir sa propre demande ;
- une seule ligne de soutien par citoyen et par demande ;
- le POST est idempotent ;
- seuls les signalements non doublons et encore actifs acceptent de nouveaux soutiens ;
- les procédures privées ne sont jamais exposées dans la liste soutenable ;
- les agents voient seulement le compteur `support_count`, jamais la liste des supporters via l'API opérationnelle.

## F76 — avis/commentaire après utilisation d'un service

### Endpoint citoyen

- `GET /api/citizen/services/{slug}/feedback/`
- `POST /api/citizen/services/{slug}/feedback/`
- `PATCH /api/citizen/services/{slug}/feedback/`

Un avis n'est accepté que si le backend trouve une utilisation vérifiable du service :

- une demande citoyenne liée au service avec statut `completed`, ou
- un rendez-vous lié au service avec statut `completed`.

Corps minimal :

```json
{
  "rating": 5,
  "comment": "Réponse rapide et claire."
}
```

Une `request_reference` ou une `appointment_reference` peut être fournie pour sélectionner explicitement la preuve d'utilisation. Sinon le backend sélectionne la dernière utilisation terminée connue.

Un citoyen possède au maximum un avis par service et peut le modifier avec PATCH. L'avis reçoit une référence `NT-AVIS-...`.

### Endpoint administration

- `GET /api/admin/service-feedback/`

Filtres : `service`, `rating`, `search`. L'accès est réservé aux administrateurs.

## F51 — inquiétudes relatives aux données personnelles

Le canal F51 est volontairement séparé du `ContactMessage` générique afin qu'un agent municipal ordinaire ne puisse pas lire une préoccupation potentiellement sensible.

### Endpoints citoyen

- `GET /api/citizen/privacy-concerns/`
- `POST /api/citizen/privacy-concerns/`
- `GET /api/citizen/privacy-concerns/{reference}/`

Exemple :

```json
{
  "topic": "data_usage",
  "subject": "Je veux comprendre l'utilisation de mes données",
  "message": "Je souhaite savoir comment mes informations sont utilisées dans mon espace."
}
```

Chaque préoccupation reçoit une référence `NT-PRIV-...` et une notification de confirmation.

### Administration

- `GET /api/admin/privacy-concerns/`
- `GET /api/admin/privacy-concerns/{reference}/`
- `PATCH /api/admin/privacy-concerns/{reference}/`

Seuls les administrateurs peuvent accéder à ces routes. Les changements de statut/notes sont inscrits dans `StaffAuditEvent` avec visibilité `ADMIN`.

## Limitation de débit

Les scopes DRF ajoutés sont :

- `citizen_participation`: 30/min ;
- `service_feedback`: 10/hour ;
- `privacy_concern`: 5/hour.

Ils sont surchargeables par variables d'environnement :

- `THROTTLE_CITIZEN_PARTICIPATION`
- `THROTTLE_SERVICE_FEEDBACK`
- `THROTTLE_PRIVACY_CONCERN`

## Installation

```bash
python manage.py migrate
python manage.py test apps.city.test_engagement_security
```
