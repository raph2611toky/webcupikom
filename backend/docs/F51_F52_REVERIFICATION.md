# Re-vérification F51 / F52

## F52 — soutien d'une demande citoyenne

La fonctionnalité reste indépendante de F76 : `CitizenRequestSupport` ne référence pas `ServiceFeedback`.

- `GET /api/citizen/supportable-requests/` est désormais consultable sans authentification et n'expose qu'une projection anonymisée.
- `GET|POST|DELETE /api/citizen/requests/{reference}/support/` reste réservé aux citoyens authentifiés.
- Une procédure privée, un doublon ou une demande fermée n'accepte pas de nouveau soutien.
- Un citoyen ne peut pas soutenir sa propre demande.
- La contrainte unique `(request, citizen)` empêche les doubles soutiens.
- Les APIs métier n'exposent que `support_count`, jamais l'identité des soutiens.

## F51 — confidentialité via ContactMessage

Le flux canonique F51 utilise désormais `ContactMessage.category` :

- `general` : contact classique ;
- `privacy` : inquiétude relative à l'utilisation des données personnelles.

Création : `POST /api/city/contact/` avec `category=privacy`.

Sécurité :

- `privacy` exige un compte citoyen authentifié pour conserver une trace liée au compte ;
- le citoyen retrouve le message dans `/api/citizen/contact-messages/` ;
- les agents ordinaires ne peuvent ni lister ni ouvrir un message `privacy` ;
- les administrateurs peuvent filtrer avec `?category=privacy` ;
- un message `privacy` ne peut être attribué qu'à un administrateur ;
- les traces d'audit d'un traitement `privacy` sont `visibility=admin`.

L'ancien modèle `PrivacyConcern` est conservé temporairement pour compatibilité avec les déploiements précédents. Il n'est pas requis par le nouveau flux ContactMessage F51.
