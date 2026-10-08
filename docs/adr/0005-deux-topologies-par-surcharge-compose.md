# ADR 0005 : deux topologies de déploiement, sélectionnées par une surcharge Compose

- **Statut** : accepté
- **Date** : 2026-10-08
- **Décideurs** : responsable du POC

## Contexte

Le POC doit démontrer deux topologies pour chaque client :

- **solution 1** : une API `common` et une API `cliN`, séparées ;
- **solution 2** : une seule API `cliN`, qui inclut `common`.

L'expression de besoin prévoit une composition de base `compose.yaml` complétée par `compose-cliN.yaml`, via `COMPOSE_FILE`. Il reste à décider comment basculer de la solution 1 à la solution 2 sans dupliquer la configuration ni modifier le front.

## Options considérées

### A. Troisième fichier, `socle/compose-standalone.yaml`, ajouté à `COMPOSE_FILE` pour la solution 2

- Avantages :
  - idiomatique ;
  - lisible : chaque fichier a un rôle unique ;
  - les fichiers clients restent indépendants de la solution.
- Inconvénients : un fichier de plus que les deux annoncés.

### B. Variable `MODE=split|standalone` interprétée dans les deux fichiers (profils et interpolation)

- Avantages : deux fichiers seulement.
- Inconvénients :
  - logique implicite, répartie entre interpolations et profils ;
  - plusieurs réglages à dériver d'une même variable (profil, arguments de build, routage du front).

## Décision

Option A. La surcharge `socle/compose-standalone.yaml` :

- désactive `api-common` en lui attribuant le profil `split`, jamais activé ;
- construit `api` avec `COMMON=true` ;
- donne à `api` l'**alias réseau `api-common`** : le point d'entrée garde la même configuration dans les deux solutions. Ce point d'entrée était d'abord le nginx du front ([ADR 0008](0008-nginx-du-front-en-reverse-proxy.md)), c'est aujourd'hui la passerelle ([ADR 0011](0011-passerelle-nginx-dediee.md)) ;
- ~~remplace les dépendances du front par `depends_on: !override`, limitées à `api`~~. Retiré le 2026-10-08 avec l'[ADR 0011](0011-passerelle-nginx-dediee.md) : la passerelle résout les noms à chaque requête, et plus aucun service ne dépend des API.

| Solution | `COMPOSE_FILE` (exemple cli1) |
|---|---|
| 1 | `socle/compose.yaml:cli1/compose-cli1.yaml` |
| 2 | `socle/compose.yaml:cli1/compose-cli1.yaml:socle/compose-standalone.yaml` |

Le Makefile dérive `COMPOSE_FILE` de `CLIENT` et `SOLUTION`.

## Conséquences

- `docker compose config` est valide sur les 4 combinaisons (vérifié), et `api-common` est absent de la configuration en solution 2.
- **Point de vigilance vérifié** : un service désactivé par profil n'est ni arrêté par `up`, ni supprimé par `up --remove-orphans` ou `down --remove-orphans`. En passant de la solution 1 à la solution 2, l'ancien conteneur `api-common` continuait donc de tourner et de répondre au nom `api-common`. Le Makefile applique `docker compose --profile "*" down --remove-orphans` avant chaque `up`.
- Une seule combinaison est déployée à la fois, sous le nom de projet fixe `poc-1-socle-n-produits`.
