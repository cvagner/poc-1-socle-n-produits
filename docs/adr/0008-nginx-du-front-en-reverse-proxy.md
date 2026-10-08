# ADR 0008 : nginx du front en reverse proxy des API

- **Statut** : remplacé par l'[ADR 0011](0011-passerelle-nginx-dediee.md) (2026-10-08) : le front ne relaie plus les API, une passerelle nginx dédiée distribue les requêtes.
- **Date** : 2026-10-08
- **Décideurs** : responsable du POC

## Contexte

Le front appelle `/api/common/hello` et `/api/cliN/hello`. Selon la solution ([ADR 0005](0005-deux-topologies-par-surcharge-compose.md)), ces deux chemins sont servis par deux API distinctes ou par une seule. Le build du front ne doit pas dépendre de la topologie.

## Options considérées

### A. Le nginx qui sert la SPA relaie aussi `/api/...` vers les API

- Avantages :
  - URL relatives, même origine, donc pas de CORS ;
  - une seule exposition réseau (le front) ;
  - la topologie reste invisible du navigateur.
- Inconvénients : le front dépend du démarrage des API (`depends_on`), et le routage se trouve dans la configuration nginx.

### B. Appels directs du navigateur vers chaque API, avec URL injectées au build ou au démarrage

- Avantages : front statique pur.
- Inconvénients : CORS à configurer, une exposition par API, et des URL différentes selon la solution, donc une configuration du front par topologie.

## Décision

Option A, avec l'image `nginxinc/nginx-unprivileged:1.30.5-alpine` (vérifiée le 2026-10-08 : UID 101 par défaut, port 8080, `curl` présent). Le template `socle/frontend/nginx/default.conf.template` est rendu au démarrage par l'`envsubst` natif de l'image, qui ne remplace que les variables définies, ici `${CLIENT}`.

| Chemin | Destination |
|---|---|
| `/api/common/` | `http://api-common:8000` |
| `/api/${CLIENT}/` | `http://api:8000` |
| autre `/api/` | `404` JSON |
| `/` | fichiers de la SPA, repli sur `index.html` |

En solution 2, le nom `api-common` est un alias réseau du service `api`.

## Conséquences

- La règle `/api/` → 404 évite que l'API d'un autre client (ou toute faute de frappe) retombe sur `index.html` avec un code 200. Contrôle vérifié : `/api/cli2/hello` sur un déploiement cli1 renvoie 404.
- nginx résout les noms d'amont au démarrage. Le front attend donc que les API soient saines (`depends_on: condition: service_healthy`).
- Le rendu du template écrit dans `/etc/nginx/conf.d`, monté en tmpfs ([ADR 0009](0009-durcissement-des-conteneurs.md)).
