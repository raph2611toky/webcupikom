# Terra Nova SMS — démonstration Android autonome

Cette version est conçue pour une présentation de Terra Nova sans serveur applicatif.
Le téléphone Android reçoit un SMS, interroge Gemini directement, maintient la conversation localement puis renvoie la réponse avec `SmsManager`.

## Architecture

```text
Citoyen
   │ SMS
   ▼
Téléphone Android central
   │
   ├─ SmsMmsReceiver
   ├─ WorkManager / récupération Inbox
   ├─ TerraNovaAssistant
   │    ├─ base de connaissances Terra Nova embarquée
   │    ├─ brouillon structuré par numéro
   │    ├─ historique conversationnel local
   │    └─ dossiers de simulation locaux
   │
   ├─ HTTPS → Gemini API
   │
   └─ SmsManager → réponse SMS au citoyen
```

Il n'y a **ni Flask, ni webhook serveur, ni Django, ni accès à `db.sqlite3`** dans cette version.
Les opérations finales sont des simulations locales destinées à illustrer l'expérience Terra Nova.

## Ce que la démo sait faire

L'assistant embarque une base de connaissances détaillée issue de la logique fonctionnelle Terra Nova. Il sait notamment :

- expliquer les services municipaux et orienter un citoyen ;
- construire progressivement un signalement ;
- reconnaître les catégories : éclairage, voirie, déchets, eau, espaces verts, accessibilité, sécurité, transport, panne électrique, urgence médicale, incendie, danger immédiat, bâtiment, etc. ;
- reproduire le routage vers Énergie, Transport, Environnement, Eau, Santé, Sécurité, Habitat ;
- reproduire les niveaux de gravité, priorité et circuits standard/prioritaire/urgence ;
- collecter lieu, rue, quartier, repère, temporalité, fréquence, danger, personnes affectées et accessibilité ;
- simuler une démarche administrative ;
- simuler une demande de rendez-vous municipal ;
- simuler un contact mairie/conseil municipal ;
- traiter un sujet de confidentialité ;
- présenter les projets municipaux de démonstration, idées, participation et soutien ;
- simuler un avis sur un service ;
- expliquer profil, accessibilité, notifications, sessions, appareils et MFA sans collecter de secrets ;
- conserver un historique distinct pour chaque numéro de téléphone ;
- créer, uniquement après confirmation, une référence locale comme `NT-R-SIM-XXXXXX` ;
- retrouver ensuite cette référence locale pour illustrer un suivi de dossier.

La base de connaissances se trouve dans :

```text
app/src/main/assets/terra_nova_knowledge.txt
```

## Règle importante de validation

Un signalement, rendez-vous, contact ou autre dossier n'est jamais validé automatiquement.
Quand les informations sont suffisantes, l'assistant produit un récapitulatif et demande :

```text
CONFIRMER
MODIFIER
ANNULER
```

Le code Android applique lui-même cette règle. Même si le modèle renvoyait par erreur l'état `confirmed`, aucun dossier simulé n'est créé sans un SMS explicitement confirmatif.

Commandes pratiques :

```text
ANNULER       annule le brouillon courant
RECOMMENCER   redémarre la conversation courante
NOUVEAU       redémarre la conversation courante
CONFIRMER     valide uniquement un brouillon suffisamment complet
```

## Exemple de démonstration

Citoyen :

```text
Il y a une grosse fuite d'eau devant l'école à Nova Sud depuis ce matin.
```

Terra Nova peut demander seulement les informations encore manquantes, par exemple si la fuite crée un danger et si une rue ou un repère plus précis est disponible.

Après complétion, l'assistant envoie un récapitulatif et demande `CONFIRMER`.
Après confirmation :

```text
Simulation enregistrée localement. Référence : NT-R-SIM-A1B2C3.
```

Un SMS ultérieur comme :

```text
Où en est NT-R-SIM-A1B2C3 ?
```

peut être répondu à partir du stockage local du même téléphone et du même expéditeur.

## Urgences

La démo sait reconnaître un scénario urgent pour montrer le routage Terra Nova, mais **elle ne déclenche aucun secours réel**.
Si un message semble décrire une urgence réelle, la réponse doit l'indiquer immédiatement et inviter la personne à contacter les services d'urgence réels/localement compétents.

## Configuration Gemini

### Option la plus simple pour la présentation

Installez l'application, ouvrez **Paramètres**, puis renseignez :

- la clé Gemini ;
- le modèle Gemini.

La valeur par défaut du projet est :

```text
gemini-3.8-flash
```

La clé saisie dans l'application est stockée dans les préférences privées de l'application Android.

### Option à la compilation

Vous pouvez également ajouter la clé dans le `local.properties` local de la machine :

```properties
sdk.dir=C:\\Users\\raph\\AppData\\Local\\Android\\Sdk
GEMINI_API_KEY=VOTRE_CLE_GEMINI
```

`local.properties` est ignoré par Git et n'est pas inclus dans ce projet livré.

> Cette architecture expose nécessairement la clé au client Android. Elle convient à une démonstration contrôlée, pas à une application de production. Une version de production doit utiliser un intermédiaire serveur et des contrôles de quota/authentification adaptés.

## Compilation Windows

Votre précédent terminal utilisait Java 8 x86. Gradle/AGP modernes doivent être lancés avec un JDK 17+ 64 bits.

Si Android Studio est installé :

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
java -version
```

Vous devez voir une JVM 64 bits moderne, pas `Java HotSpot Client VM 1.8`.

Puis, depuis le dossier du projet :

```powershell
.\gradlew.bat --stop
.\gradlew.bat clean
.\gradlew.bat assembleDebug
```

APK :

```text
app\build\outputs\apk\debug\app-debug.apk
```

Comme votre téléphone est déjà reconnu par `adb devices`, vous pouvez installer directement :

```powershell
.\gradlew.bat installDebug
```

ou :

```powershell
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

## Premier démarrage

1. Ouvrir Terra Nova SMS.
2. Autoriser la réception, lecture et envoi des SMS.
3. Ouvrir **Paramètres** et renseigner la clé Gemini.
4. Pour une démo fiable, retirer les restrictions batterie de l'application.
5. Vérifier que `Application active en arrière-plan` est activé.
6. Vérifier que `Réponses automatiques Terra Nova via Gemini` est activé.
7. Depuis un autre téléphone, envoyer un SMS au téléphone central.

## Fichiers principaux

```text
app/src/main/java/com/example/smswebhook/ai/TerraNovaAssistant.kt
    Orchestration conversationnelle, règles de confirmation et prompt système.

app/src/main/java/com/example/smswebhook/ai/GeminiClient.kt
    Appel HTTPS direct à Gemini.

app/src/main/java/com/example/smswebhook/ai/ConversationStore.kt
    Historique, brouillons et références SIM locales par numéro.

app/src/main/java/com/example/smswebhook/ai/AssistantSettings.kt
    Clé et modèle Gemini.

app/src/main/assets/terra_nova_knowledge.txt
    Base de connaissances fonctionnelle Terra Nova.

app/src/main/java/com/example/smswebhook/worker/IncomingSmsWorker.kt
    Tour conversationnel persistant puis réponse par SmsManager.

app/src/main/java/com/example/smswebhook/worker/SmsInboxRecoveryWorker.kt
    Filet de sécurité si une ROM Android rate ponctuellement le Broadcast SMS.
```

## Vie privée de la démo

Le texte des SMS traités par l'assistant est envoyé à Gemini pour générer la réponse. Ne faites pas la présentation avec de vrais mots de passe, OTP, numéros de carte ou données personnelles sensibles. L'assistant lui-même est configuré pour refuser de demander ces secrets.
