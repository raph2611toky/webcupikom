# Transport / partenaires / géolocalisation

Ce correctif regroupe le même besoin physique sous un seul modèle `CityLocation` afin de ne pas dupliquer les coordonnées, horaires et informations de contact.

## Besoins couverts

- **F36** : informations et horaires des transports municipaux.
- **F45** : localisation des services physiques.
- **F46** : accès rapide aux hôpitaux et services d'urgence.
- **Partenaires / F74** : lieux partenaires géolocalisés en réutilisant les mêmes champs. Le snapshot `requetes.json` fourni au backend s'arrête à F68 ; le correctif n'invente donc aucune règle F74 au-delà du contexte partenaires/géolocalisation demandé.

## Modèle unique

`CityLocation.kind` accepte :

- `service`
- `transport_stop`
- `hospital`
- `emergency`
- `partner`

Champs communs : adresse, quartier, horaires, téléphone, email, site web, latitude, longitude. Les points de transport ajoutent `transport_lines` et `timetable`. `practical_info` reste un objet JSON pour les informations propres à un partenaire ou à un lieu.

## API publique

- `GET /api/city/locations/`
  - filtres : `kind`, `category`, `district`, `service`, `partner`, `search`
  - proximité : `lat`, `lon`, `radius_km`
  - si des coordonnées sont fournies, la réponse expose `distance_km` et trie par distance.
- `GET /api/city/locations/{slug}/`
- `GET /api/city/locations/emergency/`
- `GET /api/city/transport/`
  - filtre optionnel `line`
  - retourne le service municipal de transport et ses points/horaires.

## Administration

- `GET|POST /api/admin/locations/`
- `GET|PATCH|DELETE /api/admin/locations/{slug}/`

`DELETE` est une désactivation logique (`is_active=false`) afin de conserver l'historique. Les créations, modifications et désactivations sont enregistrées dans `StaffAuditEvent`.

## Démonstration facultative

Aucune donnée fictive n'est injectée automatiquement par migration. Pour créer trois exemples de démonstration :

```bash
python manage.py seed_city_locations
```

Les adresses et coordonnées réelles doivent ensuite être renseignées par l'administration.
