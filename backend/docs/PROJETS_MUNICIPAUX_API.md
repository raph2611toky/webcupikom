# Projets municipaux & participation citoyenne

Ce module couvre un seul contexte métier : les projets municipaux. Il ne remplace ni ne modifie le flux `CitizenRequest` déjà existant.

## Endpoints publics

- `GET /api/city/projects/`
  - filtres : `status`, `participation_type`, `district`, `search`
  - `status=consultation` est accepté comme raccourci pour l'onglet frontend « Consultation ».
- `GET /api/city/projects/{slug}/`

La réponse expose notamment l'état, la progression, les dates, les objectifs, les étapes, la configuration de participation, le nombre de soutiens et, pour un citoyen authentifié, `is_supported`.

## Endpoints citoyen

### Consultation / décision

- `GET /api/citizen/projects/{slug}/participation/`
  - retourne la ou les traces personnelles déjà enregistrées pour ce projet.
- `POST /api/citizen/projects/{slug}/participation/`

Corps :

```json
{
  "choice": "favorable",
  "comment": "Le projet répond bien au besoin du quartier."
}
```

Le backend décide lui-même si la contribution est une `consultation` ou une `decision` à partir du projet. Un citoyen ne peut pas envoyer deux fois la même contribution pour le même type de participation. La réponse contient une référence `NT-PART-...`, la date d'enregistrement ainsi qu'un snapshot de la question et du libellé choisi afin que la preuve historique reste stable même si le projet est modifié ensuite.

### Soutien au projet

- `GET /api/citizen/projects/{slug}/support/`
- `POST /api/citizen/projects/{slug}/support/`
- `DELETE /api/citizen/projects/{slug}/support/`

Le POST est idempotent : un second clic ne crée pas un deuxième soutien.

### Idée / solution

- `GET /api/citizen/ideas/`
- `POST /api/citizen/ideas/`
- `GET /api/citizen/ideas/{reference}/`

Corps pour une idée générale :

```json
{
  "title": "Créer un jardin partagé",
  "category": "Environnement",
  "district": "Nova Centre",
  "description": "Créer un espace de jardinage partagé accessible aux habitants."
}
```

Corps pour une solution liée à un projet :

```json
{
  "project_slug": "parc-urbain-nova-centre",
  "title": "Ajouter des bancs accessibles",
  "category": "Aménagement",
  "description": "Installer plusieurs bancs accessibles près des chemins principaux."
}
```

La réponse contient une référence `IDEA-...` qui sert de preuve de dépôt.

## Endpoints administrateur

- `GET|POST /api/admin/projects/`
- `GET|PATCH|DELETE /api/admin/projects/{slug}/`
  - `DELETE` retire le projet de la publication sans supprimer ses traces.
- `GET /api/admin/project-participations/`
  - filtres : `project`, `type`, `search`
- `GET /api/admin/ideas/`
  - filtres : `status`, `project`, `search`
- `GET|PATCH /api/admin/ideas/{reference}/`
  - seuls `status` et `staff_note` sont modifiables.

Les créations/modifications de projets et l'examen des idées sont enregistrés dans `StaffAuditEvent`, comme les autres opérations administratives sensibles du backend.

## Données de démonstration facultatives

Aucune donnée fictive n'est injectée automatiquement par la migration. Pour préparer rapidement une démonstration :

```bash
python manage.py seed_municipal_projects
```

La commande crée ou met à jour trois projets Nova Terra : Parc urbain Nova Centre, Mobilité Est et Centre de santé Nova Sud.

## Mise en service

```bash
python manage.py migrate
python manage.py test apps.city.test_projects
```
