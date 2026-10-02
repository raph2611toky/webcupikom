CORRECTIF ADMIN UI V2
=====================

Cause du bug géant : les nouveaux templates utilisaient des classes admin-sidebar/sidebar-brand__logo,
mais le navigateur servait encore l'ancien django-admin-theme.css (17334 octets), qui ne contient pas ces classes.

Ce patch utilise de nouveaux noms de fichiers statiques (admin-kamo-v2-*.css/js) afin d'éviter tout conflit
avec les anciens fichiers/cache et ajoute des dimensions de secours directement dans le HTML pour le logo.

Développement (DEBUG=True / MODE_DEV=true) :
- collectstatic n'est PAS nécessaire avec runserver.
- extraire ce zip à la racine du projet (là où se trouve le dossier backend).
- relancer: python manage.py runserver
- Ctrl+F5 dans le navigateur.

Vérification utile :
python manage.py findstatic css/admin-kamo-v2.css --verbosity 2

Production :
collectstatic reste requis pour alimenter STATIC_ROOT, puis WhiteNoise sert les fichiers collectés.

Le patch n'inclut ni .env ni db.sqlite3 afin de ne pas écraser vos secrets ou votre base.
