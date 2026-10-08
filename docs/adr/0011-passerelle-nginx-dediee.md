# ADR 0011 : passerelle nginx dédiée en point d'entrée

- **Statut** : accepté, remplace l'[ADR 0008](0008-nginx-du-front-en-reverse-proxy.md)
- **Date** : 2026-10-08
- **Décideurs** : responsable du POC

## Contexte

Selon l'[ADR 0008](0008-nginx-du-front-en-reverse-proxy.md), le nginx du conteneur `front` servait la SPA **et** relayait les API. Le front portait donc un rôle de routage étranger à sa fonction, et sa configuration dépendait du client (`/api/${CLIENT}/`).

Décision révisée : le front ne relaie plus les API. Un point d'entrée placé en amont distribue les requêtes vers `front`, `api-common` et `api`. Le plan correspondant est consigné dans [docs/plan_01_gateway.md](../plan_01_gateway.md).

## Options considérées

### A. Relais dans le front (l'existant, ADR 0008)

- Avantages : aucun service de plus.
- Inconvénients : rôles mélangés ; configuration du front dépendante du client ; les noms d'amont sont résolus au démarrage, d'où des `depends_on` vers les API.

### B. Traefik, routes déclarées par labels Docker

- Avantages : chaque fichier Compose déclare ses propres routes (`/api/cliN` dans `compose-cliN.yaml`, `/api/common` sur `api` dans la surcharge standalone), ce qui rend l'alias réseau inutile. C'est la démarche la plus modulaire.
- Inconvénients : Traefik doit lire l'API Docker.
  - Socket monté : accès équivalent à root sur l'hôte.
  - Proxy de socket : un service de plus, qui lit lui-même le socket.

  Les deux s'écartent des conventions de durcissement ([ADR 0009](0009-durcissement-des-conteneurs.md)).

### C. Traefik, routes déclarées dans un fichier (provider file)

- Avantages :
  - résolution DNS à chaque requête ;
  - sonde intégrée (`traefik healthcheck --ping`) ;
  - fonctions natives : TLS automatique (ACME), métriques, traces, middlewares.
- Inconvénients : avec une table de routes statique, Traefik joue le même rôle qu'un nginx, mais introduit une technologie de plus. Ses fonctions avancées ne servent pas dans le POC (ni TLS, ni métriques).

### D. Passerelle nginx dédiée, configuration statique

- Avantages :
  - même image que le front (`nginxinc/nginx-unprivileged:1.30.5-alpine`), déjà durcie et vérifiée ;
  - une seule technologie ;
  - configuration courte, indépendante du client et de la solution.
- Inconvénients : la résolution à chaque requête demande `resolver` et un `proxy_pass` à variable. Les fonctions avancées (TLS automatique, métriques) devraient être ajoutées à la main.

## Décision

Option D. Le service `gateway` de `socle/compose.yaml` monte en lecture seule [`socle/gateway/default.conf`](../../socle/gateway/default.conf) :

| Chemin | Destination |
|---|---|
| `/healthz` | `200 ok` (sonde de la passerelle) |
| `/api/common/` | `http://api-common:8000` |
| `/api/` | `http://api:8000` |
| `/` | `http://front:8080` |

- `resolver 127.0.0.11 valid=10s` et `proxy_pass $upstream` : les noms sont résolus à chaque requête par le DNS interne de Docker.
- En solution 2, `api-common` reste l'alias réseau de `api` ([ADR 0005](0005-deux-topologies-par-surcharge-compose.md)) : la configuration de la passerelle est identique dans les deux solutions.
- La passerelle est le seul service publié (`127.0.0.1:${HTTP_PORT:-8080}`). Le front sert uniquement la SPA, avec un `default.conf` statique copié dans l'image : plus de template ni d'envsubst.

## Conséquences

Vérifié le 2026-10-08 sur les 4 combinaisons (cli1/cli2 × solution 1/2) :

- **Routage et sondes** : routes conformes, tous les conteneurs `healthy`.
- **Liens profonds** : un lien profond de la SPA (`/cli2/catalogue`) renvoie `index.html`.
- **Chaîne de requête** : elle est transmise telle quelle (`?probe=42` apparaît dans le journal du front).
- **API d'un autre client** : `/api/cli2/hello` sur un déploiement cli1 renvoie un **404 JSON émis par Laravel**, puisque l'API du client ne connaît pas la route, et non plus par nginx. L'isolation est inchangée.
- **Tolérance** : après recréation du conteneur `api` avec une nouvelle IP (192.168.232.101 → 192.168.232.102), la passerelle route correctement sans redémarrer.
- **Durcissement** : la passerelle tourne sous l'UID 10001, en lecture seule (`touch` refusé, y compris dans `conf.d`), et consomme environ 14 Mio pour une limite de 64 Mio. Le script d'entrée `10-listen-on-ipv6` signale seulement qu'il ne peut pas modifier `default.conf` (lecture seule), ce qui est attendu.
- **Front simplifié** : il n'est plus publié, n'a plus de `depends_on` ni de tmpfs sur `/etc/nginx/conf.d`, et `CLIENT` n'est plus passé à son environnement. La surcharge standalone n'a plus besoin de `!override`.
- **Pistes** : si l'infrastructure cible impose Traefik, ou si TLS automatique et métriques deviennent nécessaires, l'option C se substitue à D sans toucher aux autres services. L'option B suppose de régler l'accès à l'API Docker.
- **En-têtes `X-Forwarded-*`** : non transmis, car le POC n'en a pas besoin. Ce sera à ajouter avec TLS ou si les API doivent connaître l'URL d'origine.
