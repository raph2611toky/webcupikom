# Terra Nova — Frontend final fusionné

Cette version fusionne :
- le design et les pages fonctionnelles de la version frontend équipe ;
- l'authentification sécurisée déjà intégrée ;
- les endpoints du backend Terra Nova actuel.

## Sécurité/authentification

- `access token` JWT : mémoire React uniquement, jamais `localStorage`.
- `refresh token` : cookie `HttpOnly` géré par le backend ; Axios utilise `withCredentials: true`.
- refresh automatique et verrouillé après une réponse `401`.
- le rôle vient uniquement de `user.role` renvoyé par le backend (`citizen`, `agent`, `admin`).
- aucune sélection de rôle dans le formulaire de connexion/inscription.
- routes UI séparées strictement par rôle.
- aucune clé WebCup dans le frontend : le frontend consomme `/api/webcup/requests/` du backend.

## Configuration

Copier l'exemple correspondant à l'environnement :

```bash
cp .env.development.example .env.development
```

Variables frontend :

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_APP_URL=http://localhost:5173
VITE_AUTH_AFTER_LOGIN=/app
VITE_API_TIMEOUT_MS=15000
```

Aucun secret ne doit être placé dans une variable `VITE_*`.

## Dépendance

Le point d'entrée API utilise Axios :

```bash
npm install axios
```

## Remarque admin

Le backend actuel ne fournit pas encore d'API CRUD générale pour gérer les utilisateurs, services et actualités depuis le frontend admin. Les écrans admin conservent le design mais restent en lecture pour ces données au lieu de simuler des écritures inexistantes. Les opérations réellement exposées par le backend sont connectées.
