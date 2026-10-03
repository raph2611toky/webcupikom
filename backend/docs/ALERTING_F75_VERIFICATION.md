# Vérification alerting + F75 demandes similaires

## Alerting couvert

Le backend couvre le même flux métier avec `NewsArticle` et `CitizenNotification` :

- D18 : message global via publication/annonce ou notification globale admin ;
- F29 : alerte territoriale avec `publication_type=alert`, `target_districts`, zone affectée, consignes et expiration ;
- F30 : publication importante -> notification citoyenne + email ;
- F31 : alerte avec `audience_guidance` pour afficher des recommandations adaptées à certains publics sans profiler automatiquement les citoyens.

### Flux d'une alerte

1. `POST /api/admin/news/` crée l'alerte.
2. Les alertes publiées doivent avoir `instructions`, `affected_areas`, `source_name` et `expires_at`.
3. `deliver_news()` sélectionne uniquement les citoyens actifs, et éventuellement uniquement les quartiers ciblés.
4. Une `CitizenNotification` est créée par destinataire. Une alerte est toujours importante.
5. La notification est visible dans `/api/citizen/notifications/` et envoyée au flux realtime du citoyen.
6. Les emails des alertes dues sont tentés immédiatement après commit. La commande périodique reprend les publications programmées et les erreurs SMTP.
7. Une alerte expirée ou dépubliée disparaît automatiquement des endpoints publics et des notifications visibles.

### Worker/cron cPanel

Une seule commande est désormais suffisante :

```bash
python manage.py process_alerting --publication-limit 100 --batch-size 500 --email-limit 500
```

À planifier idéalement toutes les minutes dans cPanel. Les anciennes commandes `dispatch_news` et `send_due_notification_emails` restent compatibles.

## F75 — demandes similaires / doublons

Le modèle existant `CitizenRequest.duplicate_of` reste la source de vérité. Aucun statut parallèle ni nouveau modèle n'est ajouté.

### Détection

```http
GET /api/agent/requests/{reference}/similar/
GET /api/admin/requests/{reference}/similar/
```

Paramètres facultatifs :

- `limit` : 1 à 20, défaut 8 ;
- `min_score` : 0.20 à 0.95, défaut 0.42.

Le score est explicable et combine : titre, description, catégorie, service, quartier, lieu, infrastructure et distance GPS lorsque disponible. Aucun doublon n'est créé automatiquement.

### Marquer comme doublon

Le PATCH existant est conservé :

```http
PATCH /api/agent/requests/{reference}/
PATCH /api/admin/requests/{reference}/
```

```json
{
  "duplicate_of": 123
}
```

Pour retirer le lien :

```json
{
  "duplicate_of": null
}
```

Le backend protège déjà les cycles de doublons et journalise la modification. Les réponses agent/admin exposent maintenant aussi `is_duplicate`, `duplicate_of_reference` et `duplicate_of_title`.

La file agent/admin accepte également `?duplicate=true` ou `?duplicate=false`.
