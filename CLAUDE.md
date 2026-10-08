# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Le projet

POC « 1 socle, N produits » : un tronc commun (`archi/core`, `archi/common`, `@archi/core-ui`) partagé par plusieurs clients (`cli1`, `cli2`), chacun livré avec ses services et écrans propres, **sans qu'aucun client ne reçoive le code d'un autre**. Backend Laravel 13 sur FrankenPHP (PHP 8.5), frontend React 19 + Vite, le tout sous Docker Compose piloté par le `Makefile`.

Tout passe par Docker : ni PHP, ni Composer, ni Node ne sont installés sur le poste. Documentation, ADR, commentaires et messages de commit sont rédigés en français.

## Commandes

```sh
make up [CLIENT=cli1|cli2] [SOLUTION=1|2] [DEV=0|1]   # down, puis up --build --wait
make test CLIENT=cli1    # test de fumée : curl /api/common/hello et /api/cli1/hello
make config              # docker compose config de la combinaison courante
make ps | make logs | make down
```

- Une seule combinaison tourne à la fois ; `make up` repart toujours de zéro. L'interface est sur http://localhost:8080 (`HTTP_PORT` pour changer).
- Le Makefile construit `COMPOSE_FILE` (`socle/compose.yaml:cliN/compose-cliN.yaml[:socle/compose-standalone.yaml][:socle/compose-dev.yaml]`) et exporte `CLIENT` et `CLIENT_REV`. Pour lancer `docker compose` à la main (`exec`, `logs`…), passer les mêmes variables ou utiliser `make`. Sans `CLIENT_REV`, le cache de build ignore les modifications du client (ADR 0004) : exporter la variable ou ajouter `--no-cache`.
- Il n'existe ni tests automatisés ni linter. La vérification consiste à valider la configuration des **8 combinaisons** (client × solution × DEV) avec `make config`, puis `make up` / `make test` et les contrôles listés en section 7 du README (`served_by`, `modules_loaded`, 404 sur l'API d'un autre client, `ls /app/vendor/archi`, `id`, écriture refusée).
- `socle/compose-dev.yaml` exige `CLIENT` (`${CLIENT:?…}`) : sa validation isolée, sans fichier client ni variable, échoue volontairement.

## Architecture

### Découpage en futurs dépôts

`socle/`, `cli1/` et `cli2/` préfigurent trois dépôts distincts (ADR 0002). Règles qui en découlent :

- `socle/` ne référence jamais un client nommé ; tout ce qui est propre à un client vit dans `cliN/`, y compris `cliN/compose-cliN.yaml`.
- Le code client n'entre dans un build que par le **contexte nommé `client`** (`build.additional_contexts.client`, déclaré dans `cliN/compose-cliN.yaml`). Les contextes de build restent `socle/backend` et `socle/frontend`.
- Compose résout les chemins relatifs depuis le répertoire du **premier** fichier (`socle/`) : d'où les `../cliN/...` dans les fichiers client.

### Backend : modules en paquets Composer

- `socle/backend/host/` est un hôte Laravel sans route propre (hormis `/up`). Il déclare un dépôt Composer `path` sur `../packages/*`.
- Le `Dockerfile` copie `packages/` du socle, puis le contexte `client` dans `packages/client/` (étape `FROM scratch AS client`, vide pour `api-common`). Les arguments `COMMON` et `CLIENT` déclenchent `composer require archi/common:^0.1` / `archi/$CLIENT:^0.1`, puis `composer update`. Les dépendances sont résolues au build, sans fichier lock versionné (ADR 0010 ; `package-lock.json` est ignoré par git).
- Un module = un paquet `archi/<nom>` (`"version": "0.1.0"`, requiert `archi/core`) dont le fournisseur, déclaré dans `extra.laravel.providers` (auto-découverte), hérite de `Archi\Core\ModuleServiceProvider` et implémente `module()` et `routes()`. La classe de base l'inscrit au `ModuleRegistry` et monte ses routes sous `/api/<module>`.
- Les réponses passent par `Archi\Core\Http\ApiResponse::make()`, qui ajoute `served_by` (`APP_NAME`) et `modules_loaded` : c'est ce qui rend la topologie visible dans l'interface.

### Frontend : workspace npm

- `socle/frontend` est un workspace (`packages/*`, `apps/*`). L'appli du client y est copiée dans `apps/client` au build ; `npm run build --workspace apps/client` produit la SPA servie par nginx.
- `@archi/core-ui` exporte `AppShell`, `ApiCard`, `useApi`, `CommonScreen` et `commonMenuEntry`. `AppShell` impose le même DOM et les classes `app-*` à tous les clients. La disposition et les couleurs relèvent **uniquement** de la feuille CSS du client (`cliN/frontend/src/cliN.css`) ; ne pas ajouter de variante de mise en page dans `core-ui` (ADR 0007).
- Chaque client définit son menu (`[{ label, path, element }]`) dans `src/main.jsx`. Son `vite.config.js` doit garder `cacheDir: process.env.VITE_CACHE_DIR` (mode dev).

### Déploiement : passerelle et deux solutions

- `gateway` (nginx, `socle/gateway/default.conf`) est le seul service publié (`127.0.0.1:8080`). Il route `/api/common/` → `api-common:8000`, `/api/` → `api:8000`, `/` → `front:8080`, et répond à `/healthz`. Le front ne relaie aucune API (ADR 0011).
- **Solution 1** : `api-common` (core + common) et `api` (core + cliN) séparées.
- **Solution 2** (`compose-standalone.yaml`) : `api-common` est désactivé par le profil `split`, `api` est construit avec `COMMON=true` et porte l'alias réseau `api-common`. La configuration de la passerelle ne change donc pas. C'est pour cela que `make down` utilise `--profile "*"`.

### Mode développement (`DEV=1`, ADR 0012)

- Front : étape `dev` du Dockerfile (serveur Vite HMR derrière la passerelle). Sources montées **par répertoire, jamais par fichier** (un enregistrement atomique ferait perdre le fichier monté seul).
- API : `socle/backend/packages/{core,common}` et `cliN/backend` montés en lecture seule sur `/app/vendor/archi/*`, relus par opcache.
- Un `make up DEV=1` reste nécessaire après une modification de dépendance (`composer.json`, `package.json`), un nouveau paquet ou fournisseur de service, ou l'hôte Laravel.

## Conventions du dépôt

- **Durcissement** (ADR 0009), à conserver sur tout service : UID/GID `${APP_UID:-10001}:${APP_GID:-10001}`, `read_only: true` avec tmpfs (`/tmp`, et pour les API `storage/framework/{views,cache}` en `mode=1777`), limites CPU/mémoire, sonde `curl` (`wget` pour l'image Node du mode dev, qui n'a pas `curl`). Les API sont factorisées par l'ancre `x-api` de `socle/compose.yaml`.
- **Versions d'images épinglées** (FrankenPHP, Composer, Node, nginx-unprivileged) ; le README en tient la liste vérifiée, à mettre à jour avec toute montée de version.
- **ADR** dans `docs/adr/NNNN-<titre>.md`, en français : statut, date, décideurs, contexte, options considérées (avantages/inconvénients), décision, conséquences (ADR 0001). Une décision révisée donne un nouvel ADR, et l'ancien passe à « remplacé par ADR n ». Les plans de construction vont dans `docs/plan_NN_<sujet>.md`. Le tableau des ADR et les sections concernées du README sont mis à jour en même temps.
- **Schémas** : Mermaid avec le bloc de palette « architecture v1 » répété dans chaque diagramme du README (skill `architecture-diagrams`).
- **Commits** : Conventional Commits en français, avec des portées comme `backend`, `frontend`, `docker`, `build`, `dev`, `cli1`, `cli2`, `adr` (ex. `feat(cli2): route catalogue et entrée de menu associée`). Le code et la documentation (ADR, README) font l'objet de commits séparés.
