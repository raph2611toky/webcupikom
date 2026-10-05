# Nova Terra — SMS Conversational Gateway

Cette passerelle transforme le téléphone Android central en canal SMS conversationnel pour Nova Terra.

## Flux entrant

```text
Citoyen
  -> SMS
Android central
  -> POST /api/chatbot/sms/webhook/
Gateway Flask
  -> identification du citoyen par son numéro Nova Terra
  -> récupération des services / agents / fonctionnalités dans Django
  -> Gemini: compréhension de l'intention + extraction des champs
  -> validation avec les serializers Django
  -> SMS de question si des informations manquent
  -> récapitulatif final
Citoyen
  -> CONFIRMER
Gateway
  -> transaction Django réelle
  -> db.sqlite3 du backend
  -> événements / notifications / routage / alerte existants
  -> réponse avec la référence NT-R / NT-A / NT-C
Android
  -> SMS de confirmation au citoyen
```

Le gateway ne fait **aucun INSERT SQL brut**. Il charge le projet Django Nova Terra et utilise les modèles, serializers et services existants. Cela conserve notamment le routage automatique des signalements, la classification urgence/priorité, les contrôles de rendez-vous, les notifications et les signaux Django.

## Actions actuellement prises en charge

- signalement municipal, normal ou urgent ;
- démarche/demande administrative ;
- prise de rendez-vous ;
- message à la mairie / au conseil municipal, y compris confidentialité ;
- suivi d'une référence `NT-R-*`, `NT-A-*` ou `NT-C-*` ;
- questions sur les services et fonctionnalités connues de Nova Terra.

Les demandes WebCup visibles stockées dans `WebCupRequestSnapshot` sont également ajoutées dynamiquement au contexte de l'assistant lorsqu'elles existent dans la base.

## Validation finale obligatoire

Une action d'écriture suit toujours ce cycle :

```text
collecte -> validation Django -> résumé -> CONFIRMER -> écriture transactionnelle
```

`ANNULER`, `STOP` ou `RECOMMENCER` supprime le brouillon. Un SMS rejoué par Android avec le même `client_reference` renvoie la même réponse sans exécuter deux fois l'action.

## Configuration

Le gateway est prévu pour être placé à côté du backend :

```text
webcupikom/
├── backend/
│   ├── manage.py
│   ├── db.sqlite3
│   └── ...
└── webhook/              # ou gateway/
    ├── app.py
    ├── django_bridge.py
    ├── conversation_engine.py
    ├── conversation_store.py
    ├── gemini_service.py
    └── .env
```

Ajoutez à votre `.env` :

```env
GEMINI_API_KEY=VOTRE_CLE_GEMINI
GEMINI_MODEL=gemini-3.8-flash

NOVA_TERRA_BACKEND_PATH=../backend
NOVA_TERRA_DJANGO_SETTINGS=config.settings
NOVA_TERRA_FORCE_SQLITE=true

SMS_AI_DB_PATH=./sms_gateway_state.sqlite3
SMS_AI_SESSION_TTL_HOURS=24
SMS_AI_MAX_REPLY_CHARS=700
```

Gardez aussi vos variables existantes :

```env
ANDROID_SMS_BASE_URL=http://IP_DU_TELEPHONE:8000
GATEWAY_WEBHOOK_TOKEN=SECRET_ANDROID_GATEWAY
ANDROID_WEBHOOK_TOKEN=SECRET_ANDROID
```

`NOVA_TERRA_FORCE_SQLITE=true` empêche la configuration MySQL éventuelle du `.env` du backend de prendre la main dans le processus gateway. Django utilise alors le `backend/db.sqlite3` correspondant au code chargé.

## Installation

Le gateway importe le backend Django. Le plus simple est d'utiliser le même environnement Python que le backend, puis d'ajouter les dépendances du gateway :

```bash
cd webhook
python -m venv .venv
source .venv/bin/activate

pip install -r ../backend/requirements.txt
pip install -r requirements.txt
```

Sous Windows PowerShell :

```powershell
cd webhook
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r ..\backend\requirements.txt
pip install -r requirements.txt
```

## Lancement

```bash
python app.py
```

ou :

```bash
./run.sh
```

Health check :

```bash
curl http://127.0.0.1:8080/health/
```

## Configuration Android

L'application Android existante ajoute déjà automatiquement :

```text
/api/chatbot/sms/webhook/
```

à l'hôte configuré. Pour les SMS entrants, configurez donc **l'hôte du gateway public** dans l'application Android, par exemple :

```text
https://xxxx.ngrok-free.app
```

Le téléphone enverra alors :

```text
POST https://xxxx.ngrok-free.app/api/chatbot/sms/webhook/
```

Le JSON de réponse contient :

```json
{
  "success": true,
  "reply": "..."
}
```

et l'application Android renvoie déjà `reply` au citoyen avec `SmsManager`.

## Endpoint sortant conservé

L'ancien endpoint reste fonctionnel :

```text
POST /sms/webhook/send/
```

Il relaie les SMS du backend vers :

```text
http://IP_ANDROID:8000/sms/webhook/send/
```

Ainsi, les notifications SMS asynchrones existantes ne sont pas cassées.

## Exemples de conversation

```text
Citoyen: Il y a une grosse fuite d'eau devant l'école du quartier Nord.
Nova Terra: [demande les informations manquantes]
Citoyen: Elle coule depuis ce matin et la chaussée devient dangereuse.
Nova Terra: Prêt à enregistrer ... Répondez CONFIRMER ...
Citoyen: CONFIRMER
Nova Terra: Signalement enregistré: NT-R-....
```

```text
Citoyen: Je veux un rendez-vous pour mon dossier d'urbanisme.
Nova Terra: Avec quel agent souhaitez-vous un rendez-vous? ...
...
Citoyen: CONFIRMER
Nova Terra: Rendez-vous demandé avec succès: NT-A-....
```

## Sécurité

- aucun numéro ou contenu SMS n'est écrit dans les logs Flask ;
- token webhook obligatoire ;
- aucune écriture métier avant `CONFIRMER` ;
- serializers et transactions Django réutilisés ;
- idempotence via `client_reference` Android ;
- séparation entre `db.sqlite3` Nova Terra et `sms_gateway_state.sqlite3` ;
- le contexte envoyé à Gemini évite volontairement les données de profil identifiantes inutiles ;
- ne commitez jamais `.env` ni la base d'état SMS.

Le token actuellement compilé en dur dans l'application Android doit idéalement être déplacé vers une configuration de build non versionnée avant une mise en production publique.

## Tests

```bash
pip install -r requirements-dev.txt
pytest -q
```

Le fichier `tests/test_conversation_engine.py` vérifie notamment qu'une écriture n'est exécutée qu'après `CONFIRMER` et qu'un `client_reference` rejoué reste idempotent.
