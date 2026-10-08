# Passerelle nginx dédiée en amont, le front ne relaie plus les API

## Contexte

Aujourd'hui, le nginx du conteneur `front` sert la SPA **et** relaie les API ([ADR 0008](adr/0008-nginx-du-front-en-reverse-proxy.md)) :
- `/api/common/` → `api-common:8000` ;
- `/api/${CLIENT}/` → `api:8000` ;
- autre `/api/` → 404.

Décision révisée : **le front ne relaie plus les API**. Un point d'entrée placé en amont distribue les requêtes vers `front`, `api-common` et `api`.

Choix validés :
- **nginx dédié** (service `gateway`), plutôt que Traefik. Avec un fichier de routes statique, les deux sont équivalents. On garde une seule technologie, déjà durcie et vérifiée dans le POC (`nginxinc/nginx-unprivileged:1.30.5-alpine`).
- La découverte par labels Docker est écartée, pour ne pas ouvrir l'API Docker.
- L'alias réseau `api-common` est conservé pour la solution 2.

## Étape préalable

- `docs/plan_initial.md` renommé en `docs/plan_00_initial.md`.
- Ce plan est enregistré dans `docs/plan_01_gateway.md`.
- Les liens vers `plan_initial.md` (README, ADR 0001) sont mis à jour.

## Changements

### Nouveau : `socle/gateway/default.conf`

Configuration statique, indépendante du client et de la solution, montée en lecture seule dans l'image nginx-unprivileged, sans build.

```nginx
server {
    listen 8080;
    # DNS interne de Docker, avec résolution à chaque requête (variables) :
    # tolère le redémarrage d'un service et l'absence d'api-common au démarrage.
    resolver 127.0.0.11 valid=10s ipv6=off;

    location = /healthz { access_log off; return 200 "ok\n"; }

    location /api/common/ { set $up http://api-common:8000; proxy_pass $up; }
    location /api/        { set $up http://api:8000;        proxy_pass $up; }
    location /            { set $up http://front:8080;      proxy_pass $up; }
}
```

- Un `proxy_pass` à variable, sans partie URI, transmet l'URI d'origine telle quelle. Ce comportement sera vérifié.
- En solution 2, `api-common` est l'alias réseau de `api` : la configuration ne change pas.
- Un chemin d'API d'un autre client (`/api/cli2/...` sur un déploiement cli1) arrive à l'API du client, qui ne connaît pas la route et renvoie un 404 JSON. Le 404 vient de Laravel et non plus de nginx, et l'isolation est inchangée.
- En-têtes `X-Forwarded-*` : non requis par le POC, donc non ajoutés.

### `socle/compose.yaml`

- Nouveau service `gateway` :
  - image `nginxinc/nginx-unprivileged:1.30.5-alpine` ;
  - `./gateway/default.conf` monté en lecture seule sur `/etc/nginx/conf.d/default.conf` ;
  - port `127.0.0.1:${HTTP_PORT:-8080}:8080` : le port publié passe du front à la passerelle, et `FRONT_PORT` est renommé `HTTP_PORT` ;
  - durcissement : `user: ${APP_UID}:${APP_GID}`, `read_only`, tmpfs `/tmp`, limites 0,25 CPU / 64 Mio ;
  - sonde `curl -fsS http://localhost:8080/healthz` (curl présent dans l'image, déjà vérifié).
- `front` : plus de `ports`, plus de `depends_on` vers les API, plus de tmpfs `/etc/nginx/conf.d`.
- Pas de `depends_on` de la passerelle, grâce au `resolver`. `make up --wait` attend déjà toutes les sondes.

### `socle/compose-standalone.yaml`

- On garde le profil `split` sur `api-common`, `COMMON=true` et l'alias `api-common` sur `api`.
- On retire le bloc `front.depends_on: !override`, devenu inutile.

### Front : nginx sert seulement la SPA

- `socle/frontend/nginx/default.conf.template` est remplacé par un **`default.conf` statique** : `listen 8080`, `root`, `try_files $uri /index.html`, sans `${CLIENT}` ni `location /api/`.
- Le Dockerfile le copie directement dans `/etc/nginx/conf.d/` : plus d'envsubst au démarrage.
- `cliN/compose-cliN.yaml` : on retire `front.environment.CLIENT`, qui ne sert plus.

### Documentation

- **ADR 0011** « Passerelle nginx dédiée en point d'entrée » :
  - options considérées :
    - relais dans le front (l'existant) ;
    - Traefik avec labels (proxy de socket ou socket monté) ;
    - Traefik avec fichier ;
    - nginx dédié ;
  - arguments :
    - séparation des rôles et point d'entrée unique ;
    - Traefik avec fichier est équivalent mais introduit une technologie de plus ;
    - les labels exigent l'accès à l'API Docker ;
    - avantages propres à Traefik (TLS automatique, métriques, labels), notés comme pistes si l'infrastructure cible l'impose ;
  - conséquences :
    - `resolver` et variables ;
    - 404 renvoyé par Laravel ;
    - alias conservé ;
    - front non publié.
- **ADR 0008** : statut « remplacé par [ADR 0011](adr/0011-passerelle-nginx-dediee.md) ». On ajoute une ligne en tête, sans réécrire le reste.
- **ADR 0005** : on met à jour les conséquences (l'alias sert désormais la passerelle, `!override` du front supprimé), avec une note datée.
- **ADR 0009** : on met à jour le tableau (service `gateway`, exposition, tmpfs du front).
- **README** :
  - §1 : on ajuste la ligne sur le routage ;
  - §4 : table des routes et deux schémas, avec un nœud `gateway` (tag `gateway`) entre le navigateur et les services ;
  - §5 : diagramme de séquence navigateur → gateway → front puis → api-common ;
  - §6 : rôle des fichiers, durcissement, `HTTP_PORT` ;
  - §9 : ajout de l'ADR 0011.

  Les schémas sont contrôlés et rendus via Kroki (`https://kroki.priv.atolcd.com`).
- `docs/plan_00_initial.md` reste inchangé : c'est l'historique.

## Points à vérifier à l'implémentation

- nginx-unprivileged avec `default.conf` monté en lecture seule et sans répertoire de templates : les scripts d'entrée (`10-listen-on-ipv6…`, `20-envsubst…`) ne doivent pas échouer (à contrôler dans les journaux). Même contrôle pour le front, dont `conf.d` n'a plus de tmpfs.
- `proxy_pass $up` transmet bien l'URI complète, y compris la chaîne de requête.
- Résolution de l'alias `api-common` par `127.0.0.11` en solution 2.

## Vérification

1. `make config` sur les 4 combinaisons (cli1/cli2 × solution 1/2) ; le hook PostToolUse le fait aussi.
2. Pour chaque combinaison, `make up`, puis :
   - `make test` : `common` est servi par `api-common` (solution 1) ou `api-cliN` (solution 2), `cliN` par `api-cliN` ;
   - `curl localhost:8080/api/cli2/catalogue` sur cli2 → 200 ;
   - `/api/cli2/hello` sur cli1 → 404 JSON (Laravel) ;
   - `curl localhost:8080/cli2/catalogue` → `index.html` (lien profond de la SPA) ;
   - `make ps` : tous les conteneurs `healthy` (4 en solution 1, 3 en solution 2).
3. Le front ne relaie plus rien :
   - `docker compose port front 8080` ne renvoie rien, car le front n'est plus publié ;
   - `rg proxy_pass socle/frontend` est vide.
4. Tolérance : `docker compose restart api` puis `make test` sans redémarrer la passerelle.
5. Durcissement de la passerelle : `docker compose exec gateway id` → 10001 ; `touch /x` → `Read-only file system`.
6. Captures d'écran des fronts cli1 et cli2 inchangées.
7. Les schémas du README sont rendus sans erreur, hors diagramme de séquence (palette impossible, limite connue).

## Commits (sur demande)

1. `refactor(docker): passerelle nginx dédiée, le front ne relaie plus les API` : `socle/gateway/`, compose, nginx et Dockerfile du front, `cliN/compose-cliN.yaml`.
2. `docs(adr): ADR 0011 passerelle, ADR 0008 remplacé, mises à jour 0005 et 0009, README`.
