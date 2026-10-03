# Temps réel WebSocket — Terra Nova

La couche WebSocket est **optionnelle**. Les endpoints HTTP/REST existants restent la source de vérité et continuent de fonctionner si Redis, Daphne ou le WebSocket est indisponible.

## Dépendances

Le projet utilise Django Channels, `channels-redis`, Daphne et `redis-py`. Le channel layer Redis utilise une base dédiée (15 par défaut) et chiffre les messages du channel layer avec `REALTIME_CHANNEL_ENCRYPTION_KEY`.

## Configuration Redis recommandée

En production, privilégier le socket Unix fourni par l'hébergeur :

```env
REALTIME_ENABLED=True
REDIS_SOCKET=/home/USER/.redis/redis.sock
REDIS_PASSWORD=<secret-redis>
REALTIME_REDIS_DB=15
REALTIME_REDIS_PREFIX=terra_nova_rt
REALTIME_CHANNEL_ENCRYPTION_KEY=<secret-long-et-distinct>
REALTIME_ALLOWED_ORIGINS=https://frontend.example.com
```

Ne jamais versionner le mot de passe Redis. `REALTIME_REDIS_URL` peut être utilisé à la place des champs séparés. Le code prend le socket Unix en priorité lorsqu'une URL explicite n'est pas fournie.

## Authentification WebSocket

1. Le frontend se connecte normalement via HTTP/JWT.
2. Il appelle `POST /api/realtime/ticket/` avec le JWT HTTP habituel.
3. Le backend vérifie le JWT, `auth_token_version` et `AccountSession`, puis place dans Redis un ticket opaque de 30 secondes à usage unique.
4. Le frontend ouvre immédiatement `wss://api.example.com/ws/realtime/?ticket=<ticket>`.
5. Le ticket est consommé atomiquement. Le backend recharge l'utilisateur et la session depuis la base avant d'accepter la connexion.

Le JWT principal n'est jamais placé dans l'URL du WebSocket.

## Messages client autorisés

Le WebSocket est volontairement **lecture/synchronisation uniquement**. Les mutations métier continuent de passer par REST.
Les événements temps réel sont best-effort : après une reconnexion ou en cas de doute, `sync` puis les endpoints REST permettent de reconstruire l’état exact.

```json
{"type":"ping"}
{"type":"sync"}
{"type":"subscribe","resource":"request","id":"NT-R-2026-..."}
{"type":"unsubscribe","resource":"request","id":"NT-R-2026-..."}
{"type":"subscribe","resource":"appointment","id":"NT-A-2026-..."}
```

Chaque abonnement ressource refait une vérification de propriété/rôle en base. Un citoyen ne peut s'abonner qu'à ses propres objets ; un agent ne peut s'abonner qu'à ses rendez-vous ; les demandes sont accessibles aux agents/admins selon l'espace opérationnel existant.

## Événements serveur

La couche temps réel publie notamment :

- `notification.created`, `notification.updated`, `notifications.read_all`, `notifications.refresh` ;
- `request.created`, `request.updated`, `request.timeline.created` ;
- `staff.request.created`, `staff.request.updated` ;
- `appointment.created`, `appointment.updated`, `appointment.removed` ;
- `contact.created`, `contact.updated`, `contact.assigned` ;
- `audit.created` ;
- `service.created`, `service.updated`, `service.deleted` ;
- `news.created`, `news.updated`, `news.refresh` ;
- `webcup.sync.updated` ;
- `security.session_revoked`, `security.sessions_revoked`, `security.permissions_changed`, `security.account_disabled`.

Les données privées ne sont pas placées dans des groupes accessibles aux citoyens. Les notes internes d'une demande restent exclusivement dans le groupe staff.

## Dégradation sans Redis

Les publications sont effectuées après le commit SQL dans une file interne bornée. Une erreur Redis est journalisée puis ignorée : elle ne transforme jamais une requête HTTP réussie en erreur.

`POST /api/realtime/ticket/` renvoie `503` avec `http_fallback: true` lorsque Redis n'est pas disponible. Le frontend doit simplement continuer avec les endpoints REST et, si nécessaire, son polling existant.

## Déploiement ASGI

`passenger_wsgi.py` est conservé pour ne rien casser dans le flux WSGI existant. En revanche, un WebSocket doit être servi par un serveur **ASGI**. Exemple :

```bash
daphne -b 127.0.0.1 -p 8001 config.asgi:application
```

Le reverse proxy/hébergeur doit router `/ws/` vers ce processus ASGI avec le support Upgrade WebSocket. Si l'hébergement ne permet pas cette route, l'application REST continue de fonctionner normalement ; seule la couche temps réel reste indisponible.

Pour un déploiement entièrement ASGI, le même `config.asgi:application` sert aussi HTTP et WebSocket.

## Vérification

```bash
python manage.py check
python manage.py check_realtime
```

Puis, avec un compte connecté :

```text
GET  /api/realtime/status/
POST /api/realtime/ticket/
```

Le statut n'expose ni mot de passe, ni URL Redis, ni chemin de socket serveur.
