# Sessions, révocation et MFA email — correctif Terra Nova

## Installation

Copier les fichiers du ZIP à la racine contenant `backend/`. Le ZIP contient uniquement les nouveaux fichiers et les fichiers modifiés ; il ne contient ni `.env`, ni base de données, ni médias, ni dépendances.

```bash
cd backend
python manage.py migrate
python manage.py check
```

Redémarrer les processus Django/Passenger. Les migrations 0005 et 0006 créent les sessions, challenges OTP, compteurs partagés et événements de sécurité. Aucune variable obligatoire supplémentaire.

**Après ce déploiement, les utilisateurs déjà connectés doivent se reconnecter.** Les anciens JWT sans identifiant de session sont refusés. Les sessions Django antérieures sans version de sécurité sont également invalidées.

## Intégration frontend : cookies et CSRF

Le refresh reste exclusivement dans le cookie HttpOnly. Les JWT d'accès portent désormais `sid` et `security_version`. Ne jamais stocker un refresh dans le localStorage.

Avant les POST de connexion classique, connexion Google, validation MFA, refresh et logout, appeler `GET /api/auth/csrf/` avec les cookies (`credentials: "include"`). Conserver `csrf_token` et l'envoyer dans `X-CSRFToken` avec les cookies. Cette protection s'applique aussi si le corps est JSON. Les autres routes du compte utilisent le JWT Bearer.

```javascript
const csrf = await fetch(`${API_URL}/api/auth/csrf/`, {
  credentials: "include",
}).then(response => response.json());

const response = await fetch(`${API_URL}/api/auth/login/`, {
  method: "POST",
  credentials: "include",
  headers: {"Content-Type": "application/json", "X-CSRFToken": csrf.csrf_token},
  body: JSON.stringify({email, password, remember: true}),
});
```

Configurer `CSRF_TRUSTED_ORIGINS` et `CORS_ALLOWED_ORIGINS` avec les origines exactes du frontend. En HTTPS, garder les cookies Secure ; adapter SameSite uniquement si frontend/API sont sur des sites différents. Ne pas activer CORS pour toutes les origines.

Django décrit le fonctionnement du header CSRF dans sa documentation : https://docs.djangoproject.com/en/dev/howto/csrf/

## Endpoints

| Méthode | URL | Fonction |
|---|---|---|
| GET | `/api/auth/csrf/` | Fournit le jeton CSRF et son cookie. |
| POST | `/api/auth/mfa/email/send/` | Envoie le code MFA au propriétaire après validation du premier facteur. |
| POST | `/api/auth/mfa/verify/` | Valide TOTP, code de récupération ou OTP email. |
| GET | `/api/account/mfa/` | État du MFA et méthodes disponibles. |
| POST | `/api/account/mfa/email/send/` | Envoie une preuve MFA email liée à une action sensible et à la session. |
| GET | `/api/account/sessions/?page=1` | Sessions personnelles, 50 par page. |
| POST | `/api/account/sessions/revoke/request/` | Réauthentification et envoi du code de révocation. |
| POST | `/api/account/sessions/revoke/confirm/` | Confirmation et révocation immédiate des sessions ciblées. |
| POST | `/api/account/sessions/current/logout/` | Déconnexion immédiate par Bearer de la session courante. |
| POST | `/api/auth/logout/` | Déconnexion immédiate de la session du cookie refresh ; CSRF requis. |
| POST | `/api/auth/refresh/` | Rotation du refresh dans la même session ; CSRF requis. |
| GET | `/api/account/security/events/` | Historique personnel des créations et révocations de sessions et interventions des agents. |
| GET | `/api/agent/citizens/?search=email&page=1` | Liste des citoyens pour agent ou administrateur. |
| GET, PATCH | `/api/agent/citizens/{id}/` | Consultation et administration limitée d'un citoyen. |
| DELETE | `/api/account/` | Suppression personnelle confirmée, route existante sécurisée. |

Les listes de citoyens et d'événements sont paginées (50 par page). Les objets de session ne contiennent jamais de jeton, de `refresh_jti` ou de secret MFA. `user_agent` et IP sont des indications, pas une preuve de l'identité d'un appareil. L'IP provient de REMOTE_ADDR ; aucun X-Forwarded-For fourni par le client n'est utilisé. Configurer correctement le proxy de production si nécessaire.

## Connexion avec MFA email

L'activation MFA existante par TOTP reste inchangée. **Lorsque le MFA est activé, email devient une méthode alternative**, en plus de TOTP et des codes de récupération. Cette modification n'ajoute pas d'inscription MFA exclusivement par email.

1. `POST /api/auth/login/` ou `/api/auth/google/` valide le premier facteur et renvoie `mfa_required`, `mfa_token`, `methods: ["totp", "email", "recovery_code"]` et `expires_in`. Aucun nouveau JWT/cookie de session n'est délivré avant validation du MFA.
2. `POST /api/auth/mfa/email/send/` avec `{"mfa_token": "..."}`. Réponse : `email_challenge_id`, `expires_in: 300`, `message`.
3. `POST /api/auth/mfa/verify/` avec les cookies, le header CSRF et :

```json
{"mfa_token":"...","email_challenge_id":"uuid","email_code":"123456"}
```

Le code arrive uniquement sur l'adresse vérifiée du compte. La requête ne permet pas de choisir une adresse de destination. Fournir exactement une preuve : `mfa_code`, `recovery_code` ou `email_code` avec `email_challenge_id`. Un nouveau challenge de connexion invalide le précédent.

## Révoquer une session ou plusieurs sessions

Aucune limite du nombre de sessions connectées n'est imposée.

1. Lister les sessions et choisir un identifiant.
2. Demander la révocation avec la preuve d'identité primaire :

```json
{"session_id":"uuid-cible","current_password":"mot-de-passe-actuel"}
```

Pour un compte Google : remplacer `current_password` par `credential`, ou par `code` + `state` obtenus via le flux OAuth. Le compte Google doit correspondre au propriétaire.

3. Confirmer avec le code reçu :

```json
{"session_id":"uuid-cible","email_challenge_id":"uuid-challenge","email_code":"123456"}
```

Pour toutes les autres sessions : remplacer `session_id` par `"all_other_sessions": true` aux deux étapes. La session courante reste active. Pour toutes les sessions, y compris la session courante : utiliser `"all_sessions": true` aux deux étapes. Choisir une seule cible.

La réponse contient `revoked_count` et `requires_relogin`. Le challenge est lié au propriétaire, à son email, à sa version de sécurité, à la session qui effectue l'action et à la cible. Il ne peut être réutilisé pour une autre session. Le code email est obligatoire pour une révocation distante même si le MFA n'est pas activé. Une déconnexion de sa session courante peut se faire directement avec `/account/sessions/current/logout/`.

## MFA email pour actions sensibles

Lorsque le MFA est activé, appeler `/api/account/mfa/email/send/` avec :

```json
{"action":"/api/account/change-password/"}
```

Puis ajouter `email_challenge_id` et `email_code` au corps de cette action, avec la réauthentification primaire. Le code remplace uniquement TOTP/recovery, pas le mot de passe ou Google.

Actions admises : changement/définition de mot de passe, demande de changement email, suppression personnelle, désactivation MFA, renouvellement des codes de récupération. Le code est lié à l'URL exacte et à la session. Un changement email demande maintenant une réauthentification primaire même pour un compte Google seul, et une preuve MFA si activé.

## Demandes 29, 30, 33

| ID | Traitement |
|---|---|
| 29 | Suppression personnelle avec `confirmation: "DELETE"`, mot de passe ou réauthentification Google et MFA si activé. Les sessions et OTP liés sont supprimés par cascade ; les JWT sont rejetés ensuite. Réponse HTTP 204. |
| 30 | Les agents et administrateurs disposent de routes dédiées aux citoyens. Modification autorisée uniquement de prénom, nom, téléphone, quartier et état actif. Mot de passe/Google de l'agent requis et TOTP/recovery si son MFA est activé. Les agents ne peuvent ni changer un rôle, ni accéder à un compte agent/admin, ni changer l'email, le mot de passe ou le MFA d'un citoyen. Chaque intervention est journalisée ; désactivation/réactivation invalide les anciennes sessions. |
| 33 | Limitation réelle par compte ET par IP, compteurs en base partagés entre workers, délais temporaires et réponse HTTP 429 avec Retry-After. Pas de blocage permanent du compte ni limite de sessions. |

Les routes d'administration complète préexistantes restent réservées aux administrateurs. Les changements d'état/rôle/email vérifié dans l'API admin et les changements de sécurité dans l'admin Django révoquent également les sessions.

## Garanties et limites opérationnelles

- À chaque authentification JWT, la session doit exister, être active, non expirée et correspondre au compte et à sa version de sécurité. Les anciens access tokens sont rejetés dès la requête suivante après révocation, sans attendre leur expiration.
- La rotation refresh garde le même `sid`, met à jour le `jti` en base et refuse un ancien refresh. Verrouillage transactionnel du compte et de la session pour sérialiser les opérations sous MySQL/MariaDB.
- Changement/réinitialisation du mot de passe, changement email et activation/désactivation MFA invalident les sessions. Après ces actions, le frontend doit revenir à la connexion. Les sessions Django sont contrôlées par la même version de sécurité ; elles ne sont pas listées comme sessions JWT dans `/account/sessions/`.
- OTP aléatoires de 6 chiffres, durée 5 minutes, HMAC côté serveur, consommation unique, 5 tentatives maximum. Les échecs restent comptabilisés même lorsque la transaction de l'action échoue. Un nouvel envoi invalide le précédent pour le même usage/cible.
- Envoi OTP : 3 par propriétaire sur 5 minutes, tous usages et sessions confondus. Tentatives de connexion : 10 par email sur 5 minutes et 60 par IP sur 5 minutes. Contrôle supplémentaire : 120 mutations par IP sur 5 minutes, 20 actions du compte par propriétaire sur 5 minutes, 10 requêtes par challenge MFA sur 5 minutes. Les throttles DRF existants s'ajoutent à ces protections.
- En cas d'échec SMTP, réponse générique 500 et challenge invalidé. La réception réelle dépend de la configuration SMTP ; les tests utilisent une boîte mail en mémoire.
- Les nouveaux JWT contiennent une version de sécurité et une session ; les secrets et OTP ne figurent jamais dans les réponses. Les réponses des endpoints du compte sont `Cache-Control: no-store`.
- Les événements conservent les types d'action et les noms des champs modifiés, sans les mots de passe ou les codes OTP. Les événements dont le compte est supprimé sont anonymisés par SET_NULL.

Planifier quotidiennement :

```bash
python manage.py cleanup_security
python manage.py flushexpiredtokens
```

Le nettoyage supprime les challenges expirés depuis plus d'un jour, les compteurs vieux d'un jour, les sessions expirées depuis plus de 90 jours et les événements de plus de 180 jours. Il ne supprime pas les sessions JWT encore valides.

## Validation

```bash
python manage.py test apps.users apps.city --noinput
python manage.py makemigrations --check --dry-run
```

Tests exécutés avec Python 3.12, Django 6.1.1, DRF 3.18.1 et SimpleJWT 5.5.1, sur une base SQLite isolée. **77 tests réussis.** Les tests couvrent les endpoints existants et les cas de sécurité ajoutés. MySQL/MariaDB et un serveur SMTP externe n'ont pas été disponibles pour un test d'intégration ; vérifier ces deux services sur l'hébergement avant mise en production.
