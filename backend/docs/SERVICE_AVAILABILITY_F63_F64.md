# Disponibilité des services municipaux — F63 / F64

Ce correctif complète le modèle `MunicipalService` existant sans créer un second système de services.

## Besoins couverts

- **F63** : un administrateur ou un responsable municipal (`agent`) peut rendre rapidement un service indisponible puis le remettre en service.
- **F64** : un service indisponible reste visible côté citoyen avec son état, le motif, la date de début de l'interruption, une éventuelle estimation de retour et la prochaine action conseillée.

`is_active` reste la source de vérité de compatibilité : les formulaires existants de demande, contact et rendez-vous continuent donc de refuser automatiquement un service indisponible.

## Endpoints de disponibilité

Les deux routes utilisent exactement la même logique et les mêmes contrôles :

- `PATCH /api/agent/services/{slug}/availability/`
- `PATCH /api/admin/services/{slug}/availability/`

### Rendre indisponible

```json
{
  "is_available": false,
  "reason": "Maintenance technique en cours.",
  "alternative_action": "Utilisez le formulaire de contact pour les demandes urgentes.",
  "expected_restore_at": "2026-10-04T08:00:00+03:00"
}
```

Le `reason` est obligatoire lors d'une désactivation. `expected_restore_at` et `alternative_action` sont facultatifs.

### Remettre en service

```json
{
  "is_available": true
}
```

Les métadonnées d'interruption courante sont alors nettoyées. La modification reste conservée dans `StaffAuditEvent`.

## API publique

`GET /api/city/services/` et `GET /api/city/services/{slug}/` exposent désormais aussi les services indisponibles.

Chaque service contient :

```json
{
  "availability": {
    "status": "unavailable",
    "is_available": false,
    "can_start_request": false,
    "reason": "Maintenance technique en cours.",
    "unavailable_since": "...",
    "expected_restore_at": "...",
    "next_action": "Utilisez le formulaire de contact pour les demandes urgentes.",
    "updated_at": "..."
  }
}
```

La liste accepte aussi `?available=true` ou `?available=false`.

Les `highlights` continuent volontairement à ne montrer que les services disponibles.
