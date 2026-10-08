# ADR 0006 : FrankenPHP comme serveur des API Laravel

- **Statut** : accepté
- **Date** : 2026-10-08
- **Décideurs** : responsable du POC

## Contexte

Chaque API Laravel doit être servie en HTTP dans un conteneur. La composition doit rester simple, puisqu'elle compte jusqu'à deux API par déploiement, et respecter les conventions de durcissement ([ADR 0009](0009-durcissement-des-conteneurs.md)).

## Options considérées

### A. FrankenPHP (Caddy et PHP dans un seul binaire)

- Avantages : un seul conteneur par API ; serveur de production ; image officielle avec variante Alpine.
- Inconvénients : moins répandu que php-fpm ; Caddy écrit sa configuration sous `XDG_CONFIG_HOME`/`XDG_DATA_HOME`, qu'il faut rediriger en lecture seule.

### B. php-fpm + nginx

- Avantages : couple classique et éprouvé.
- Inconvénients : deux conteneurs par API (jusqu'à quatre par déploiement), une configuration FastCGI à maintenir et des volumes de code partagés ou une double image.

### C. `php artisan serve`

- Avantages : aucune configuration.
- Inconvénients : serveur de développement mono-processus, inadapté même pour une démonstration représentative.

## Décision

Option A, avec l'image `dunglas/frankenphp:1.13.0-php8.5-alpine` (PHP 8.5.11), vérifiée le 2026-10-08 :

- extensions requises par Laravel présentes (`php -m`) ;
- `curl` disponible pour la sonde de santé.

Configuration de l'image :

- `SERVER_NAME=:8000` : HTTP simple, port non privilégié ;
- `XDG_CONFIG_HOME` et `XDG_DATA_HOME` sous `/tmp`, monté en tmpfs ;
- `APP_ENV=production`, `LOG_CHANNEL=stderr`, `SESSION_DRIVER=array` et `CACHE_STORE=array` : ni base de données, ni fichiers de session.

Le Caddyfile par défaut de l'image est conservé.

## Conséquences

- Le mode worker de FrankenPHP, qui garde l'application en mémoire, n'est pas activé. Ce serait une piste de performance hors POC.
- L'image de base embarque une sonde de santé sur le port d'administration 2019. Compose la remplace par une sonde sur `/up`.
- Le build installe `unzip` dans l'étape de construction, car l'image ne fournit pas l'extension `zip` dont Composer a besoin pour extraire les archives.
