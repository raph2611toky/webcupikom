# Terra Nova — intégration frontend/backend

## Authentification

- L'`access token` JWT reste uniquement en mémoire dans `src/api/api.js`.
- Le refresh token reste dans le cookie `HttpOnly` émis par Django ; Axios utilise `withCredentials: true`.
- Aucun secret backend ni clé WebCup n'est présent dans `VITE_*`.
- Après connexion, Google OAuth ou vérification d'e-mail, le frontend redirige selon `user.role` : `citizen`, `agent`, `admin`.
- Une inscription locale n'ouvre pas de session avant la vérification de l'adresse e-mail, conformément au backend.

## Routage par rôle

- Citizen : `/citizen/*`
- Agent : `/agent/*`
- Admin : `/admin/*`

`App.jsx` protège chaque espace avec le rôle exact renvoyé par le backend. Le backend reste l'autorité finale avec ses permissions DRF.

## Endpoints intégrés

### Public / Auth

`/auth/register/`, `/auth/login/`, `/auth/google/redirect/`, `/auth/google/`, `/auth/refresh/`, `/auth/logout/`, `/auth/verify-email/`, `/auth/resend-verification/`, `/auth/password-reset/`, `/auth/password-reset/confirm/`.

### Compte

`/account/profile/`, `/account/change-password/`, `/account/set-password/`, `/account/change-email/`, `/account/change-email/confirm/`, `/account/`.

Le lien backend `/confirm-email-change?token=...` est pris en charge par le frontend.

### Ville publique

`/city/services/`, `/city/services/<slug>/`, `/city/news/`, `/city/news/<slug>/`, `/city/contact/`.

Le formulaire Contact crée un message dans le backend. Les agents/admins le retrouvent ensuite dans leur espace.

### Citizen

`/citizen/dashboard/`, `/citizen/requests/`, `/citizen/requests/<reference>/`, `/citizen/contact-messages/`, `/citizen/contact-messages/<reference>/`, `/citizen/notifications/`, `/citizen/notifications/<id>/`, `/citizen/notifications/read-all/`.

### Agent

`/agent/dashboard/`, `/agent/requests/`, `/agent/requests/<reference>/`, `/agent/citizens/`, `/agent/citizens/<id>/`, `/agent/assignees/`, `/agent/contact-messages/`, `/agent/contact-messages/<reference>/`.

### Admin

`/admin/dashboard/`, `/admin/users/`, `/admin/users/<id>/`, `/admin/services/`, `/admin/services/<slug>/`, `/admin/news/`, `/admin/news/<slug>/`, `/admin/contact-messages/`, `/admin/contact-messages/<reference>/`, `/admin/requests/`, `/admin/requests/<reference>/`, `/admin/system/`.

### WebCup

`/webcup/requests/`, `/webcup/requests/?force=1`, `/webcup/requests/local/`, `/webcup/status/`.

Le navigateur ne contacte jamais directement l'API officielle WebCup et ne reçoit jamais sa clé API.

## Variables frontend

Développement :

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_APP_URL=http://localhost:5173
VITE_AUTH_AFTER_LOGIN=/app
VITE_API_TIMEOUT_MS=15000
```

En production, seules les URLs publiques changent dans le fichier `.env.production` ; aucun secret ne doit être ajouté dans une variable `VITE_*`.
