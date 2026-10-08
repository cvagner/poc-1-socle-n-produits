# POC « 1 socle, N produits » : tronc commun et services spécifiques par client

## Contexte

Le répertoire `poc-1-socle-n-produits` est vide : il ne contient aucun fichier ni dépôt git. Le POC doit démontrer qu'un écosystème peut partager un tronc commun (`core`, `common`) et des modules propres à chaque client (`cli1`, `cli2`) :
- **backend** Laravel :
  - solution 1 : API `common` + API `cliN` séparées ;
  - solution 2 : API `cliN` incluant `common` ;
- **frontend** React : composants `core` et deux applications finales `cli1` et `cli2` ;
- l'ensemble est orchestré par Docker Compose et un Makefile minimal.

Choix validés :
1. une image backend par cible, sans code d'un autre client dedans ;
2. la solution 2 est activée par un fichier de surcharge dédié ;
3. les API tournent sur FrankenPHP.

Outillage local vérifié par `docker --version`, `docker compose version` et `which` :
- Docker 29.8.2, Compose v5.6.0, GNU Make 4.4.1, Node 24.21 ;
- **pas de PHP ni de Composer sur l'hôte** : tout ce qui touche à PHP passe par Docker.

## Arborescence cible

Le POC tient dans un seul dépôt git, mais anticipe un découpage en dépôts distincts. Chaque client consultera son propre dépôt et le dépôt `socle`. Au premier niveau, on trouve donc un répertoire par futur dépôt, et aucun répertoire ne référence un autre client.

```
poc-1-socle-n-produits/
├── Makefile  README.md  .gitignore    # liant du POC (n'appartient à aucun futur dépôt)
├── docs/                              # plan_initial.md + adr/
├── socle/                             # futur dépôt « socle » (core + common), lisible par tous les clients
│   ├── compose.yaml                   # name: poc-1-socle-n-produits ; front + api-common + api (générique)
│   ├── compose-standalone.yaml        # solution 2 : common inclus dans api, api-common désactivé
│   ├── backend/
│   │   ├── Dockerfile                 # contexte nommé `client` facultatif (additional_contexts)
│   │   ├── host/                      # squelette Laravel minimal (seule appli « déployable »)
│   │   └── packages/
│   │       ├── core/    archi/core   : ApiResponse + ModuleRegistry + CoreServiceProvider
│   │       └── common/  archi/common : GET /api/common/hello   (requiert archi/core)
│   └── frontend/
│       ├── package.json               # workspaces npm : packages/*, apps/*
│       ├── Dockerfile                 # contexte nommé `client` → apps/client → build Vite → nginx-unprivileged
│       ├── nginx/default.conf.template
│       └── packages/core-ui/          # @archi/core-ui : AppShell (nav 2 écrans), ApiCard, useApi, CommonScreen
├── cli1/                              # futur dépôt « cli1 »
│   ├── compose-cli1.yaml
│   ├── backend/                       # paquet archi/cli1 : GET /api/cli1/hello (requiert archi/core)
│   └── frontend/                      # appli Vite + React (JS) : écran « Commun » + écran « Spécifique cli1 »
└── cli2/                              # futur dépôt « cli2 », même structure que cli1
```

- **Assemblage par contextes de build nommés** (`build.additional_contexts`) :
  - le contexte principal d'une image est le socle (`socle/backend` ou `socle/frontend`) ;
  - le code du client n'arrive que par le contexte `client`, déclaré dans `compose-cliN.yaml` ;
  - le build de cli1 ne voit donc jamais `cli2/`. L'isolation est garantie dès le contexte de build, et pas seulement dans l'image finale.
- **Trajectoire après le découpage** (documentée dans le README, hors POC) :
  - `archi/core` et `archi/common` seront publiés dans un registre Composer privé (Satis ou registre GitLab), et `@archi/core-ui` dans un registre npm ;
  - un contexte nommé peut aussi être une URL git ;
  - un dépôt client récupérera le socle en sous-module ou en clone voisin.

## Backend

- **Modules = paquets Composer** (`socle/backend/packages/{core,common}`, `cliN/backend`) :
  - chacun a un `ServiceProvider` découvert automatiquement par Laravel (`extra.laravel.providers`), qui enregistre ses routes (`Route::prefix('api/<module>')->middleware('api')`) et se déclare auprès du `ModuleRegistry` de `core` ;
  - `core` est une simple bibliothèque : elle n'expose aucune route métier.
- **Réponse type** (via `Archi\Core\Http\ApiResponse`) : `{ module, message, served_by, modules_loaded }`.
  - `served_by` vaut `APP_NAME` (api-common ou api-cli1) ;
  - `modules_loaded` liste les modules présents dans l'API ;
  - ces deux champs rendent visible dans l'interface la différence entre la solution 1 et la solution 2.
- **`host/`** :
  - squelette généré par `composer create-project laravel/laravel` (via l'image `composer:2`, sous mon UID), puis élagué : pas d'assets, de vues ni de base de données ;
  - `composer.json` déclare un dépôt `path` `../packages/*` avec `symlink: false` et requiert seulement `archi/core` ;
  - la sonde de santé utilise la route intégrée `/up`.
- **`socle/backend/Dockerfile`** (multi-étapes) :
  - étape *build* sur l'image FrankenPHP, avec `composer` copié depuis `composer:2` ;
  - si le contexte nommé `client` est fourni, il est copié dans `packages/client` ;
  - `composer require archi/common` si `COMMON=true`, puis `archi/$CLIENT` si `CLIENT` est défini, puis `--no-dev -o`. Le fichier `bootstrap/cache/packages.php` est donc généré au build ;
  - pour `api-common`, qui n'a pas de client, l'étape par défaut est `FROM scratch AS client`, remplacée par le contexte nommé quand il existe. Ce mécanisme sera vérifié au premier build ; à défaut, on utilisera un contexte vide explicite ;
  - étape *runtime* FrankenPHP : `SERVER_NAME=:8000`, `XDG_CONFIG_HOME`/`XDG_DATA_HOME` sous `/tmp`, fichiers lisibles par tous (`chmod a+rX`) pour accepter un UID arbitraire ;
  - environnement : `LOG_CHANNEL=stderr`, `SESSION_DRIVER=array`, `CACHE_STORE=array`.
  - Compromis assumé du POC : le `composer.lock` est résolu au build pour chaque cible et n'est pas versionné.

## Frontend

- `@archi/core-ui`, consommé en source par les applications via les workspaces, fournit :
  - `AppShell({ title, menu, footer })` : une structure DOM unique, identique pour les deux clients, en 4 zones aux classes stables : `.app-shell`, puis `header.app-header`, `nav.app-menu`, `main.app-main` et `footer.app-footer`. La navigation passe par react-router, et l'entrée de menu active porte la classe `.is-active` ;
  - `useApi(url)` et `ApiCard` : appel GET et affichage de la réponse, dont `served_by` et `modules_loaded`, avec des classes `.api-card*` ;
  - `CommonScreen` et `commonMenuEntry` : l'écran commun et son entrée de menu, partagés par les deux clients et appelant `/api/common/hello` ;
  - **aucune mise en forme visuelle** : seulement une feuille structurelle minimale (reset, `box-sizing`). La disposition et les couleurs relèvent de chaque client.
- `cliN/frontend` contient :
  - `src/main.jsx` : `AppShell` avec le titre du client et un menu `[commonMenuEntry, { label: "Espace cliN", path: "/cliN", element: <CliNScreen/> }]` ;
  - `src/CliNScreen.jsx` : l'écran spécifique, qui appelle le web service `/api/cliN/hello` ;
  - **`src/cliN.css`**, une feuille par client, qui pilote toute la disposition par CSS grid sur les classes du shell, ainsi que les couleurs (variables CSS) :
    - **cli1, sobre** : menu latéral gauche sur toute la hauteur (`grid-template-areas: "menu header" "menu main" "menu footer"`), palette neutre de gris et d'ardoise avec un seul accent bleu sourd ;
    - **cli2, pastel** : en-tête, puis menu horizontal juste en dessous, puis contenu et pied de page (`"header" "menu" "main" "footer"`), palette pastel (menthe, lavande, pêche) ;
  - au build, ce répertoire est copié dans `apps/client` du workspace du socle et dépend de `@archi/core-ui`.
- Démonstration visée : même socle de composants et même DOM, avec deux rendus très différents obtenus par la seule feuille CSS du client.
- Le front appelle toujours des chemins relatifs `/api/...`. Le nginx du conteneur front joue le rôle de reverse proxy, ce qui évite le CORS et masque la topologie :
  - `/api/common/` → `http://api-common:8000` ;
  - `/api/${CLIENT}/` → `http://api:8000` ;
  - le template est rendu par l'`envsubst` natif de l'image dans `/etc/nginx/conf.d`, monté en tmpfs.

## Docker Compose

| Fichier | Rôle |
|---|---|
| `socle/compose.yaml` | `name: poc-1-socle-n-produits` ; `front` (port `127.0.0.1:8080:8080`), `api-common` (args `COMMON=true`), `api` (args `COMMON=false`) ; durcissement commun |
| `cliN/compose-cliN.yaml` | `front` (arg et env `CLIENT=cliN`, contexte `client: ../cliN/frontend`), `api` (arg `CLIENT=cliN`, contexte `client: ../cliN/backend`, `APP_NAME=api-cliN`) |
| `socle/compose-standalone.yaml` | `api-common` : `profiles: [split]`, donc désactivé ; `api` : `COMMON=true`, alias réseau `api-common` ; `front.depends_on` repris avec `!override` |

- Combinaisons, toutes lancées depuis la racine :
  - solution 1 : `COMPOSE_FILE=socle/compose.yaml:cli1/compose-cli1.yaml` ;
  - solution 2 : `COMPOSE_FILE=socle/compose.yaml:cli1/compose-cli1.yaml:socle/compose-standalone.yaml`.
- Compose résout les chemins relatifs depuis le répertoire du **premier** fichier, ici `socle/`. C'est pourquoi `compose-cliN.yaml` référence `../cliN/...`, et cela correspond au futur clone voisin du socle. Le comportement sera confirmé avec `docker compose config`.
- Le nom de projet est fixe (`poc-1-socle-n-produits`) : on déploie une seule combinaison à la fois. Changer de client ou de solution recrée les conteneurs et reconstruit les images ; c'est le rôle du `--build` dans le Makefile.
- Grâce à l'alias réseau, la configuration nginx du front est identique dans les deux solutions.
- **Durcissement** de chaque service, conforme aux conventions du `CLAUDE.md` global :
  - `user: "${APP_UID:-10001}:${APP_GID:-10001}"` et `read_only: true` ;
  - tmpfs pour `/tmp` et, selon le service, pour `storage/framework/{cache,views}` ou `/etc/nginx/conf.d` ;
  - `deploy.resources.limits` : api 0.5 CPU / 256M, front 0.25 CPU / 64M ;
  - `healthcheck` sur `/up` pour les API et sur `/` pour le front.
- **Points à vérifier à l'implémentation**, avant de les écrire dans les fichiers :
  - tags exacts et récents : Laravel stable, PHP supporté par FrankenPHP, `nginxinc/nginx-unprivileged`, Node LTS, React, Vite ;
  - présence de `curl`/`wget`/`bash` dans chaque image, avec `docker run --rm --entrypoint sh <img> -c 'command -v curl wget bash'`, pour choisir la forme de la sonde ;
  - support d'un UID arbitraire par nginx-unprivileged ;
  - besoin éventuel d'un `APP_KEY` (normalement inutile pour des routes `api` sans cookie) ;
  - comportement de `profiles` et `!override` dans la surcharge, confirmé par `docker compose config`.

## Makefile (minimal)

```make
CLIENT   ?= cli1
SOLUTION ?= 1
export COMPOSE_FILE := socle/compose.yaml:$(CLIENT)/compose-$(CLIENT).yaml$(if $(filter 2,$(SOLUTION)),:socle/compose-standalone.yaml)

up:     ; docker compose up -d --build --wait
down:   ; docker compose down
ps:     ; docker compose ps
logs:   ; docker compose logs -f
config: ; docker compose config
test:   ; curl -fsS localhost:8080/api/common/hello; curl -fsS localhost:8080/api/$(CLIENT)/hello
```

Exemple : `make up CLIENT=cli2 SOLUTION=2`.

## Clients cli1 et cli2

Les deux clients sont produits intégralement et ont la même structure :
- `cliN/compose-cliN.yaml` ;
- `cliN/backend`, le paquet `archi/cliN` avec la route `GET /api/cliN/hello` ;
- `cliN/frontend`, l'appli React.

Ils diffèrent par le titre, la couleur de thème et le message renvoyé par l'API, pour qu'on voie la différence au premier coup d'œil.

## README.md (racine)

Le README explique le projet en reprenant la démarche du plan. Les schémas Mermaid suivent la palette du skill `architecture-diagrams`, chargé à l'implémentation, et chaque schéma est contrôlé et rendu via Kroki (`https://kroki.priv.atolcd.com`).

1. **Objectif du POC** : tronc commun et modules par client, et ce qu'on cherche à démontrer.
2. **Organisation des sources** : arborescence, rôle de chaque répertoire de premier niveau et futurs dépôts avec leurs droits de consultation.
   - Schéma `flowchart` : socle (core, common, core-ui), cli1 et cli2, avec les dépendances « s'appuie sur » et les accès des clients.
3. **Assemblage des images** : contexte principal du socle, contexte nommé `client`, sélection des paquets.
   - Schéma `flowchart` : sources → contextes de build → images `api-common`, `api` (cli1 seul, ou common+cli1) et `front-cli1`.
4. **Déploiement, solution 1 et solution 2** : un schéma par solution.
   - Schémas `flowchart` : navigateur → front nginx → `/api/common/` et `/api/cliN/`, routés vers `api-common` + `api` ou vers `api` seul (alias `api-common`).
5. **Déroulé d'une requête** : schéma `sequenceDiagram` navigateur → nginx → API, avec la réponse `served_by` et `modules_loaded`.
6. **Composition Docker** : rôle de chaque fichier, valeurs de `COMPOSE_FILE` pour les 4 combinaisons, durcissement.
7. **Utilisation** : prérequis, commandes `make` et contrôles attendus (repris de la section Vérification).
8. **Trajectoire après le POC** : registres Composer et npm privés, séparation des dépôts, points ouverts (lock files, mode développement).
9. **Décisions d'architecture** : table des ADR, avec un lien vers chacun.

## Documentation (`docs/` à la racine)

- `docs/plan_initial.md` : ce plan, consigné **en premier**, avant tout code.
- `docs/adr/NNNN-titre.md` : les ADR ci-dessous. Le README les liste et y renvoie.

## ADR (`docs/adr/`)

- **Format** : MADR en français, avec le skill `engineering:architecture` chargé à l'implémentation. Chaque ADR comporte titre, statut, date (2026-10-08), contexte, options considérées (avec avantages et inconvénients), décision et conséquences, dont les compromis du POC.
- **Statut** : « Accepté » pour les choix validés dans cette session.
- **Schémas** : un schéma Mermaid seulement quand il éclaire la décision, contrôlé via Kroki.

| N° | Titre | Options écartées |
|---|---|---|
| 0001 | Consigner les décisions d'architecture en ADR (MADR) | wiki, aucune trace |
| 0002 | Découpage des sources en futurs dépôts `socle`, `cli1`, `cli2` | monorepo durable, un dépôt par module |
| 0003 | Modules backend en paquets Composer Laravel auto-découverts | modules internes à une appli (namespaces), micro-services indépendants |
| 0004 | Une image par cible, assemblée par contextes de build nommés (aucun code d'un autre client) | image unique avec activation par variable |
| 0005 | Deux topologies de déploiement (solution 1 séparée, solution 2 intégrée) sélectionnées par une surcharge Compose, avec un alias réseau `api-common` | variable `MODE` et profils dans 2 fichiers |
| 0006 | FrankenPHP comme serveur des API Laravel | php-fpm + nginx, `artisan serve` |
| 0007 | Front : composants partagés `@archi/core-ui`, DOM unique, disposition et couleurs par une feuille CSS par client | composants dupliqués, thème en JS ou CSS-in-JS |
| 0008 | nginx du front en reverse proxy des API (chemins relatifs, ni CORS ni topologie exposée) | appels directs du navigateur vers chaque API avec CORS |
| 0009 | Durcissement des conteneurs : UID arbitraire non root, `read_only` + tmpfs, limites, sondes | valeurs par défaut des images |
| 0010 | Résolution des dépendances (lock Composer/npm) au build, compromis du POC, et trajectoire vers des registres privés | locks versionnés par cible |

## Git

- `git init`, puis création de la branche `feat/poc-architecture` avant le premier commit.
- Découpage proposé en Conventional Commits :
  1. `chore: init` (avec `docs/plan_initial.md`) ;
  2. `feat(backend): …` ;
  3. `feat(frontend): …` ;
  4. `feat(docker): compose + Makefile` ;
  5. `feat(cli1): …` et `feat(cli2): …`, un commit par client ;
  6. `docs: README avec schémas` ;
  7. `docs(adr): décisions d'architecture du POC`.
- Les commits ne seront faits que sur demande.

## Vérification

1. `docker compose config -q` sur les 4 combinaisons (cli1/cli2 × solution 1/2). Le hook PostToolUse le fait aussi pour chaque fichier modifié.
2. `make up CLIENT=cli1` puis `make test` :
   - `common` est servi par `api-common`, `cli1` par `api-cli1` ;
   - `curl localhost:8080/api/cli2/hello` → 404 ;
   - `make ps` : tous les services sont `healthy`.
3. `make up CLIENT=cli1 SOLUTION=2` : les deux appels sont servis par `api-cli1`, avec `modules_loaded = [core, common, cli1]` ; `api-common` est absent.
4. Isolation : `docker compose run --rm --entrypoint ls api vendor/archi` → pas de `cli2`. Aucun fichier de `cli1/` ne référence `cli2/`, ce qu'on contrôle avec `rg -l cli2 cli1/` (résultat vide).
5. Durcissement : `docker compose exec api id` → UID 10001 ; une écriture hors des tmpfs échoue.
6. Navigateur sur http://localhost:8080 : en-tête, menu, contenu et pied de page. L'écran commun et l'écran cliN affichent les données de leur web service. cli1 a un menu latéral pleine hauteur aux couleurs sobres, cli2 un menu horizontal sous l'en-tête aux couleurs pastel.
7. Mêmes contrôles avec `CLIENT=cli2`, solutions 1 et 2.
8. README : chaque bloc Mermaid est rendu sans erreur par l'instance Kroki interne `https://kroki.priv.atolcd.com`.
