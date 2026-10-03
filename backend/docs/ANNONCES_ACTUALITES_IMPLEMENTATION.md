# Annonces, actualités et alertes — Terra Nova

Ce correctif s’applique **après** `terra_nova_signalements_patch.zip`, lui-même appliqué après le correctif sessions/MFA. Extraire les fichiers à la racine du backend, à côté de `manage.py`.

```bash
python manage.py migrate
python manage.py check
```

Redémarrer Django/Passenger. Aucune base de données ni configuration secrète n’est fournie dans l’archive. Les migrations conservent les anciennes publications et rattachent leurs notifications existantes. Elles marquent les actualités déjà publiées comme diffusées afin d’éviter un envoi massif rétroactif. Les anciens brouillons et publications futures pourront être diffusés à leur échéance.

## Besoins couverts

| Code | Comportement fourni |
|---|---|
| D06 | Consultation publique, recherche, catégories, détail complet, image de couverture avec texte alternatif, lien vers un service et source officielle. |
| D18 | Annonce générale, diffusion aux comptes citoyens actifs, épinglage, priorité, programmation et expiration. |
| F29 | Alerte destinée à des quartiers, zone concernée, source, gravité, consignes obligatoires et fin de validité ; flux d’alertes actives. |
| F30 | Notification dans l’espace citoyen ; email pour une publication importante ou une alerte ; suivi des envois et reprise après échec. |
| F31 | Alerte et consignes distinctes par public, éditées et validées par un administrateur. **La composante IA n’est pas implémentée** : aucun fournisseur n’est configuré dans ce backend. Aucune caractéristique médicale ou vulnérabilité n’est déduite du compte citoyen. |

Le frontend n’est pas inclus dans ce correctif : il doit afficher ces champs, exploiter les filtres et intégrer le flux d’alertes dans un bandeau ou une zone visible.

## Modèle de publication

`publication_type` : `news`, `announcement`, `alert`.
`severity` : `info`, `warning`, `critical`.

| Groupe | Champs |
|---|---|
| Texte | `title` (220), `slug` (240), `category` (100), `excerpt` (320), `content` (100 000 caractères maximum) |
| Calendrier | `is_published`, `published_at`, `expires_at`, `publication_state`, `created_at`, `updated_at` |
| Visibilité | `is_pinned`, `is_important`, `severity`, `publication_type` |
| Diffusion | `notify_residents`, `target_districts` (50 quartiers maximum) |
| Contexte | `affected_areas` (5 000), `service`, `source_name`, `source_url` |
| Action | `instructions` (20 000), `audience_guidance` (20 publics maximum), `contact_phone`, `action_label`, `action_url` |
| Image | `cover_url`, `cover_alt` (300), fichier envoyé sur l’endpoint dédié |
| Gestion | `author`, `delivery_started_at`, `delivery_completed_at` en lecture seule |

Une création par API est un **brouillon par défaut**. Pour publier : `is_published: true`. Une date future programme la publication. Une date d’expiration passée la retire de la consultation publique et empêche les emails encore en attente. L’heure serveur utilise des dates avec fuseau ; transmettre des ISO 8601 explicites, par exemple `2026-10-04T08:00:00+03:00`.

Une alerte publiée exige `instructions`, `affected_areas`, `source_name` et `expires_at`. La fin doit être postérieure à la date de publication. Le contenu reste éditorial : fournir des consignes validées par l’autorité compétente.

Les liens d’action et de source doivent utiliser HTTPS sans identifiants intégrés. `action_label` et `action_url` vont ensemble. Les textes sont destinés à être affichés comme du texte : ne pas injecter `content`, `instructions` ou les messages via `innerHTML` sans une sanitation adaptée côté frontend.

## Routes

Préfixe : `/api/`. Les routes publiques n’exigent pas de session. Les routes `admin/` exigent un JWT appartenant à un administrateur ; un agent ou citoyen ne peut pas publier.

| Méthode | Route | Usage |
|---|---|---|
| GET | `city/news/` | Publications actives, liste paginée |
| GET | `city/news/{slug}/` | Détail d’une publication active |
| GET | `city/alerts/` | Alertes actives uniquement |
| GET | `city/news/{slug}/cover/` | Image d’une publication active |
| GET / POST | `admin/news/` | Liste de gestion / création JSON |
| GET / PATCH / DELETE | `admin/news/{slug}/` | Consulter, corriger, retirer de la publication |
| GET / POST / DELETE | `admin/news/{slug}/cover/` | Prévisualiser, remplacer, retirer l’image |
| GET | `admin/news/{slug}/delivery/` | Compteurs de diffusion et d’emails |

DELETE sur une publication la repasse en brouillon. Le contenu et l’historique de diffusion sont conservés. Republier le même dossier n’envoie pas un second exemplaire de notification aux mêmes comptes.

Les listes acceptent `category`, `search`, `publication_type`, `severity`, `important`, `district`, `page` et `page_size`. L’administration accepte aussi `published` et `state=draft|scheduled|published|expired`. Les valeurs de filtres invalides provoquent HTTP 400. Pagination : 50 par défaut, 100 maximum, réponse `{count,next,previous,results}`. Adapter les anciens clients qui attendaient un tableau brut.

Ordre de visibilité : criticité, épinglage, date de publication décroissante, identifiant. Le filtre `district=Sud` renvoie les publications générales et celles ciblant Sud. Le détail des annonces reste public, même lorsqu’une notification cible un quartier : le ciblage n’est **pas** un mécanisme de confidentialité.

## Exemple de brouillon d’alerte

POST `/api/admin/news/`, Content-Type `application/json` :

```json
{
  "title": "Information officielle — quartier sud",
  "publication_type": "alert",
  "severity": "warning",
  "category": "environnement",
  "excerpt": "Consultez les informations et les consignes municipales.",
  "content": "Description détaillée et vérifiée de la situation.",
  "is_published": false,
  "is_important": true,
  "is_pinned": true,
  "notify_residents": true,
  "target_districts": ["Sud"],
  "affected_areas": "Quartier sud, périmètre précisé par la mairie",
  "source_name": "Service municipal compétent",
  "instructions": "Insérer ici les consignes officielles validées.",
  "audience_guidance": [
    {
      "audience": "Personnes nécessitant une assistance",
      "instructions": "Insérer ici les modalités d’assistance validées par le service compétent."
    }
  ]
}
```

Renseigner ensuite `published_at` et `expires_at`, puis PATCH `is_published: true`. Ces exemples ne constituent pas des recommandations médicales ou de gestion d’une catastrophe réelle.

`audience_guidance` contient des paires `{audience,instructions}`. Les consignes pour tous les publics sont consultables ; aucune liste de personnes vulnérables n’est construite ni transmise à un tiers.

## Images

POST `/api/admin/news/{slug}/cover/` en multipart avec `image` et `cover_alt`. Formats JPEG, PNG ou WebP, 8 Mio maximum et 20 mégapixels. L’image est décodée puis réencodée en JPEG/PNG ; animations, faux fichiers et images excessives sont rejetés. Les métadonnées EXIF/GPS sont retirées.

Le stockage utilise `PRIVATE_REPORT_ROOT` du correctif précédent, avec des noms aléatoires. Ne pas exposer directement ce répertoire via le serveur web. L’image devient publique uniquement via l’endpoint qui vérifie la fenêtre de publication. Le brouillon reste prévisualisable via la route administrateur authentifiée. Les anciennes images sont supprimées après validation de la transaction et les nouveaux fichiers sont nettoyés si l’enregistrement échoue.

Le frontend peut utiliser directement le `cover_url` public dans une balise image. Les URL de prévisualisation administrateur nécessitent un téléchargement authentifié puis un Blob, comme les photos privées des signalements. Toutes ces réponses portent `Cache-Control: no-store` ; les images portent aussi `X-Content-Type-Options: nosniff`.

## Notifications et tâches planifiées

À la publication immédiate, un premier lot de 500 citoyens au maximum est traité après validation de la transaction. Les publications futures, les lots suivants et la reprise après incident sont traités par :

```bash
python manage.py dispatch_news --limit 100 --batch-size 500
python manage.py send_due_notification_emails --limit 500
```

**Configurer ces deux commandes toutes les minutes** avec le Python de l’environnement virtuel, depuis le dossier `manage.py`, ou dans un worker supervisé. Ces commandes sont fournies ; le correctif ne configure pas automatiquement le cron de votre hébergement. Les emails utilisent les paramètres SMTP existants.

La visibilité publique suit directement les dates et ne dépend pas du cron. Les notifications programmées et les emails ont une latence liée à sa fréquence et à la taille de la file. Au-delà de 500 destinataires, augmenter la cadence ou le nombre de lots suivant la charge. Un incident dans le traitement immédiat est journalisé et peut être repris par la commande.

Les notifications sont créées pour les comptes citoyens actifs. Une liste de quartiers vide cible tous ces citoyens. Le rapprochement avec `User.district` est insensible à la casse ; standardiser les noms de quartiers dans les profils. Un compte sans quartier ne reçoit pas de notification ciblée, mais conserve l’accès aux annonces publiques. Les inscriptions après la fin de la diffusion ne provoquent pas de rattrapage rétroactif.

Le curseur de diffusion et le lot de notifications sont enregistrés dans la même transaction, avec verrouillage de la publication. Une contrainte unique `(user, related_news)` empêche les doublons. Les emails sont envoyés par le mécanisme existant, qui conserve les erreurs et réessaie les messages non envoyés. Comme pour tout envoi SMTP, une panne entre l’acceptation par le serveur mail et l’enregistrement local peut occasionner une répétition : l’exactement-une-fois n’est pas garanti côté serveur SMTP.

Après début de diffusion, `slug`, `target_districts`, `published_at` et `notify_residents` sont figés. Créer une nouvelle publication pour une nouvelle campagne ou un nouveau public. Les corrections éditoriales mettent à jour le titre et le résumé des notifications existantes ; elles ne renvoient pas les emails déjà expédiés. Un retrait ou une expiration masque les notifications liées et bloque les emails en attente. Les emails déjà reçus ne peuvent pas être retirés.

Le statut de diffusion fournit `recipients`, `read`, `emails_sent`, `emails_pending`, `emails_failed`, `started_at` et `completed_at`. Les compteurs d’emails en attente/échec restent des compteurs de file, y compris après retrait ; `completed_at` indique la fin de création des notifications et non la fin d’envoi SMTP.

## Vérification

```bash
python manage.py test apps.users apps.city --noinput
python manage.py makemigrations --check --dry-run
```

Les tests locaux utilisent SQLite et un service email de test. Ils couvrent les droits, dates, ciblage, reprise, unicité, retrait, images, validations et schémas. La concurrence sur MySQL/MariaDB et la délivrabilité réelle SMTP doivent être vérifiées sur l’hébergement. La sortie synthétique de validation et les schémas Swagger sont inclus dans ce correctif.
