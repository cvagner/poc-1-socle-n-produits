# Mode développement : surcharge `socle/compose-dev.yaml`

## Contexte

Aujourd'hui, toute modification d'un client ou du socle impose `make up` : reconstruction des images, `composer update` et `npm install`, puis redémarrage. Le README liste le « mode développement (serveur Vite et rechargement à chaud) » parmi les points ouverts.

Objectif : en développement, voir immédiatement les modifications :
- **front** : serveur Vite avec rechargement à chaud (HMR) ;
- **API** : code PHP des paquets relu sans reconstruction.

Le tout reste servi par la passerelle sur http://localhost:8080 et compatible avec les 4 combinaisons (client × solution).

**Réponse à la question posée : oui, une surcharge supplémentaire.** Elle s'ajoute en dernier à `COMPOSE_FILE`, exactement comme `compose-standalone.yaml`, ce qui donne 8 combinaisons sans aucun nouveau fichier par client. Les alternatives seraient :
- des profils dans `compose.yaml` : le mode dev serait mêlé à la composition de production ;
- un fichier dev par client : duplication.

Les deux sont moins lisibles.

```
COMPOSE_FILE=socle/compose.yaml:cli1/compose-cli1.yaml[:socle/compose-standalone.yaml]:socle/compose-dev.yaml
make up CLIENT=cli1 SOLUTION=2 DEV=1
```

## Faits vérifiés (2026-10-08)

- `node:24.21.0-alpine` : `wget` (busybox) et `fetch` sont disponibles pour la sonde ; pas de `curl`.
- FrankenPHP : `opcache.validate_timestamps=On` et `revalidate_freq=2`. Une modification PHP est donc vue en moins de 2 s, sans mode worker et sans cache de routes (c'est la configuration actuelle).

## Changements

### 1. Front : étape `dev` dans `socle/frontend/Dockerfile`

```dockerfile
FROM node:24.21.0-alpine AS dev        # dépendances installées dans l'image
WORKDIR /src
COPY package.json ./
COPY packages/ packages/
ARG CLIENT_REV=
RUN echo "Sources client : ${CLIENT_REV:-non renseignée}"
COPY --from=client / apps/client/
RUN npm install --no-audit --no-fund
CMD ["npm", "run", "dev", "--workspace", "apps/client"]

FROM dev AS build                       # la production réutilise l'étape dev
RUN npm run build --workspace apps/client
```

- Les `node_modules` sont dans l'image : pas d'installation au démarrage, et compatible avec `read_only`.
- `cliN/frontend/package.json` : ajout d'un script `"dev": "vite --host 0.0.0.0 --port 8080 --configLoader runner"`. `--configLoader runner` évite l'écriture du fichier temporaire `vite.config.js.timestamp-*.mjs` à côté de la configuration, qui est en lecture seule ; à vérifier sur Vite 8.

### 2. Passerelle : WebSocket et en-tête Host (`socle/gateway/default.conf`)

- HMR : la `location /` relaie les WebSocket (`proxy_http_version 1.1`, `Upgrade` et `Connection` via un `map $http_upgrade`).
- `proxy_set_header Host $http_host` : Vite refuse un en-tête Host inconnu (`front:8080`) depuis sa protection contre le DNS rebinding.
- Sans effet sur la production : nginx ne fait que servir les fichiers statiques.

### 3. `socle/compose-dev.yaml` (nouveau, indépendant du client grâce à `${CLIENT}`)

**`front`**

| Réglage | Valeur |
|---|---|
| `build.target` | `dev` |
| Volumes en lecture seule | `./frontend/packages/core-ui/src` → `/src/packages/core-ui/src` ; `../${CLIENT}/frontend/src` → `/src/apps/client/src` ; `../${CLIENT}/frontend/index.html` → `/src/apps/client/index.html` |
| tmpfs | `/tmp` ; `/src/node_modules/.vite:mode=1777` (cache de Vite) |
| Limites | 1 CPU, 512 Mio (Vite consomme bien plus que nginx) |
| Sonde | `wget -q -O /dev/null http://localhost:8080/` |

**`api` et `api-common`**

| Réglage | Valeur |
|---|---|
| `environment` | `APP_ENV=local`, `APP_DEBUG=true` |
| Volumes de `api-common` (lecture seule) | `./backend/packages/core` et `./backend/packages/common` sur `/app/vendor/archi/{core,common}` |
| Volumes de `api` (lecture seule) | `core`, `common`, et `../${CLIENT}/backend` sur `/app/vendor/archi/${CLIENT}` |

- En solution 1, le montage de `common` dans `api` reste inerte : le paquet n'est pas déclaré dans `bootstrap/cache/packages.php`.
- Les montages se font sur `vendor/archi/*`, des copies installées au build (`symlink: false`) : les sources du dépôt remplacent ces copies.
- L'utilisateur, `read_only` et le durcissement restent ceux de la base.

### 4. `Makefile`

- `DEV ?= 0` ; si `DEV=1`, `:socle/compose-dev.yaml` est ajouté en dernier à `COMPOSE_FILE`.
- `CLIENT` est exporté, car `compose-dev.yaml` l'interpole.

### 5. Documentation

- **ADR 0012** « Mode développement par surcharge Compose » :
  - options considérées : surcharge, profils, fichiers par client, développement hors conteneur ;
  - décision : étape `dev` partagée avec le build, montages en lecture seule sur `vendor/archi/*`, HMR via la passerelle ;
  - limites ci-dessous.
- **README** :
  - §6 : rôle de `compose-dev.yaml` et valeurs de `COMPOSE_FILE` ;
  - §7 : `make up DEV=1` et ses limites ;
  - §8 : retirer « mode développement » des points ouverts ;
  - §9 : ajout de l'ADR 0012.
- `docs/plan_02_dev.md` : ce plan, consigné avant le code.

### Limites assumées (documentées)

Il faut repasser par `make up DEV=1` (reconstruction) pour :
- ajouter ou modifier une dépendance (`composer.json`, `package.json`) ;
- ajouter un nouveau paquet, ou un nouveau fournisseur de service (découverte Laravel au build) ;
- modifier `socle/backend/host` ou `vite.config.js`.

Le classmap optimisé se rabat sur PSR-4 pour une nouvelle classe : à vérifier.

## Points à vérifier à l'implémentation

- Vite 8 : options `--configLoader runner`, `--host` et `--port`, et HMR derrière la passerelle. Le port client du WebSocket doit être 8080, identique au port publié : si `HTTP_PORT` diffère, il faudra `server.hmr.clientPort`, à documenter.
- Le serveur Vite doit fonctionner sous l'UID 10001 avec un système de fichiers en lecture seule (aucune écriture hors `/tmp` et `.vite`).
- inotify sur les montages en lecture seule : le HMR doit se déclencher à la modification d'un fichier de `cliN/frontend/src` et de `core-ui/src`.
- Montage d'un répertoire sur `vendor/archi/<paquet>` avec `read_only: true` (création du point de montage).

## Vérification

1. `make config` sur les 8 combinaisons (cli1/cli2 × solution 1/2 × DEV 0/1).
2. `make up DEV=1 CLIENT=cli2` : tous les conteneurs `healthy`.
   - `curl localhost:8080/` sert le HTML de Vite (présence de `/@vite/client`).
   - `make test` répond comme avant.
3. Rechargement à chaud du front : on modifie un libellé dans `cli2/frontend/src/Cli2Screen.jsx`, puis on vérifie :
   - les journaux de `front` montrent `hmr update` ;
   - une capture headless montre le nouveau libellé sans reconstruction.

   Même test sur `core-ui/src/CommonScreen.jsx`. Les modifications sont ensuite annulées.
4. Rechargement du PHP : on modifie le message de `cli2/backend/routes/api.php`, puis `curl /api/cli2/hello` renvoie le nouveau message en moins de 3 s, sans reconstruction. Même test sur `socle/backend/packages/common`, en solution 1 (`api-common`) et en solution 2 (`api`). Les modifications sont ensuite annulées.
5. Durcissement en dev : `id` → 10001, `touch` hors tmpfs → `Read-only file system` pour `front` et `api`.
6. Non-régression : `make up` sans `DEV` donne la production à l'identique (front nginx, captures inchangées).
7. Schémas du README, si un schéma est ajouté : rendu Kroki.

## Commits (sur demande)

1. `docs: plan du mode développement (plan_02_dev)`.
2. `feat(dev): surcharge compose-dev.yaml (Vite HMR, sources PHP montées)` : Dockerfile du front, passerelle, `compose-dev.yaml`, Makefile, `package.json` des clients.
3. `docs(adr): ADR 0012 mode développement, README`.
