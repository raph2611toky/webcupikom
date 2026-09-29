# Backend Django — Comptes, authentification et administration

Ce backend fournit le socle utilisateur minimal demandé : authentification email/mot de passe et Google, JWT, vérification email, profil, changement/suppression de compte, réinitialisation du mot de passe, administration Django personnalisée et emails transactionnels.

## Démarrage local

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Sans variables MySQL, le projet utilise SQLite en développement. Si `DB_NAME` est défini, il utilise MySQL.

## Routes principales

- `POST /api/auth/register/`
- `POST /api/auth/verify-email/`
- `POST /api/auth/resend-verification/`
- `POST /api/auth/login/`
- `POST /api/auth/google/` avec `{ "credential": "<Google ID token>" }`
- `POST /api/auth/refresh/`
- `POST /api/auth/logout/`
- `POST /api/auth/password-reset/`
- `POST /api/auth/password-reset/confirm/`
- `GET/PATCH /api/account/profile/`
- `POST /api/account/change-password/`
- `POST /api/account/set-password/` (utile pour un compte Google sans mot de passe local)
- `POST /api/account/change-email/`
- `POST /api/account/change-email/confirm/`
- `DELETE /api/account/` avec `confirmation: "DELETE"`
- `/admin/` administration Django personnalisée

## Google Sign-In

Le frontend transmet le credential Google (ID token) à `/api/auth/google/`. Le backend vérifie le jeton avec `GOOGLE_CLIENT_ID`, puis associe le compte via le claim Google `sub`.

## Emails fournis

- vérification d'adresse email ;
- bienvenue ;
- réinitialisation du mot de passe ;
- confirmation de changement de mot de passe ;
- confirmation de nouvelle adresse email ;
- notification d'adresse email modifiée ;
- alerte de sécurité ;
- confirmation de suppression du compte.

En développement, `EMAIL_BACKEND` utilise la console par défaut. Configure SMTP dans `.env` pour envoyer réellement les emails.
