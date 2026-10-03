# Terra Nova — état backend

| Demande | État backend | Implémentation |
|---|---|---|
| D01 — inscription | FAIT | `/api/auth/register/`, vérification email, Google |
| D03 — connexion | FAIT | `/api/auth/login/`, JWT + refresh HttpOnly, Google, logout |
| D04 — contact mairie | FAIT | `POST /api/city/contact/` avec référence de confirmation |
| D05 — services municipaux | FAIT | `GET /api/city/services/` et détail par slug |
| D06 — actualités | FAIT | `GET /api/city/news/` et détail par slug |
| D07 — accueil clair | SUPPORT BACKEND FAIT | services + actualités disponibles pour la page d'accueil |
| D08 — profils | FAIT | rôle `citizen`, `agent`, `admin` dans `User` et dans le payload auth |
| D09 — droits d'accès | FAIT | permissions DRF par rôle pour espaces citoyen/agent |
| D19 — espace agents + API Nova Terra | FAIT BACKEND | `GET /api/webcup/requests/`, proxy sécurisé + copie locale de secours |
| F22 — demandes habitants côté agents | FAIT BACKEND | `/api/citizen/requests/` + `/api/agent/requests/` avec statuts |

La réalisation visuelle de D07, D19 et F22 reste naturellement côté frontend.
