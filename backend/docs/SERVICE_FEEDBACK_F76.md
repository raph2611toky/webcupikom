# F76 — Avis après utilisation d'un service

Cette fonctionnalité est indépendante de F51 (vie privée) et F52 (soutien d'une demande).

## Règles

- citoyen authentifié uniquement ;
- une utilisation du service doit être vérifiable : demande `completed` ou rendez-vous `completed` ;
- la preuve doit appartenir au même citoyen et au même service ;
- exactement une preuve est conservée (`source_request` XOR `source_appointment`) ;
- la preuve est protégée par `RESTRICT` et ne peut pas être supprimée isolément tant que l’avis existe ;
- un seul avis par citoyen et par service ;
- note comprise entre 1 et 5 ;
- commentaire limité à 3 000 caractères ;
- la preuve d'utilisation devient immuable après création ;
- double POST/concurrence protégé par la contrainte unique et `get_or_create` ;
- l'administration peut consulter les avis mais pas les créer/modifier/supprimer via Django admin.

## API citoyenne

### GET `/api/citizen/services/{slug}/feedback/`

Retourne l'éligibilité, `can_create`, `can_update`, les utilisations terminées disponibles et l'avis existant.

### POST `/api/citizen/services/{slug}/feedback/`

```json
{
  "rating": 5,
  "comment": "Très bon accueil.",
  "request_reference": "NT-R-2026-XXXXXXXX"
}
```

`request_reference` et `appointment_reference` sont facultatifs mais mutuellement exclusifs. Si aucun n'est fourni, le backend choisit automatiquement la dernière utilisation terminée du service.

### PATCH `/api/citizen/services/{slug}/feedback/`

Permet uniquement de modifier `rating` et `comment`. La preuve d'utilisation ne peut pas être remplacée.

## API administration

### GET `/api/admin/service-feedback/`

Filtres : `service`, `rating`, `search`. Réservé aux administrateurs.

## Migration

`0016_servicefeedback_usage_source_constraint.py` protège les sources avec `RESTRICT` et ajoute la contrainte SQL imposant exactement une preuve d'utilisation.
