# ADR 0004 : une image par cible, assemblée par contextes de build nommés

- **Statut** : accepté
- **Date** : 2026-10-08
- **Décideurs** : responsable du POC

## Contexte

Les API à produire sont `api-common` (core + common) et, pour chaque client, `api` (core + cliN, ou core + common + cliN en solution 2). Le front de chaque client combine `@archi/core-ui` et l'application du client. Un client ne doit recevoir aucun code d'un autre client.

## Options considérées

### A. Une image par cible ; code client fourni par un contexte de build nommé

- Avantages :
  - le build de cli1 ne voit jamais `cli2/`, l'isolation est donc garantie dès le contexte de build ;
  - le Dockerfile reste dans le socle et ne contient aucun nom de client ;
  - un contexte nommé peut plus tard pointer vers une URL git.
- Inconvénients : il y a une image par combinaison, à reconstruire à chaque bascule dans le POC.

### B. Image unique contenant tous les modules, activés par variable d'environnement

- Avantages : un seul build, bascule instantanée.
- Inconvénients : le code de tous les clients est livré à chacun, ce qui contredit l'exigence. L'activation devient un réglage d'exécution, facile à mal positionner.

## Décision

Option A, avec BuildKit et `build.additional_contexts` de Compose.

**Backend** (`socle/backend/Dockerfile`) :

- l'étape `FROM scratch AS client` fournit un contexte vide par défaut, remplacé par le contexte nommé `client` quand il est déclaré. Ce comportement a été vérifié par un test de build : le fichier du contexte nommé apparaît, et le répertoire reste vide sans lui ;
- les arguments `COMMON=true|false` et `CLIENT=cliN` pilotent `composer require` avant `composer update --no-dev --optimize-autoloader` ;
- l'image finale ne contient que l'hôte et son `vendor/`.

**Front** (`socle/frontend/Dockerfile`) :

- le contexte nommé `client` est copié dans `apps/client` du workspace npm du socle ;
- l'étape suivante lance le build Vite, puis copie `dist/` dans l'image nginx.

Les contextes nommés sont déclarés dans `cliN/compose-cliN.yaml` (`client: ../cliN/backend` et `../cliN/frontend`).

## Conséquences

- Contrôle : `docker compose exec api ls /app/vendor/archi` liste au plus `cli1 common core` pour cli1. Vérifié sur les 4 combinaisons.
- Les images sont nommées par Compose `poc-1-socle-n-produits-<service>` et partagées entre combinaisons. `make up` reconstruit systématiquement (`--build`). Un nommage par cible (`api-cli1`, `api-cli1-standalone`…) sera nécessaire hors POC, pour publier les images.
- Construire `api` sans contexte `client` donne une API core seule. Ce n'est pas une erreur, mais une cible sans intérêt.
