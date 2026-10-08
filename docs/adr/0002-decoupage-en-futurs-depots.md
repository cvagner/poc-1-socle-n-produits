# ADR 0002 : découper les sources en futurs dépôts `socle`, `cli1`, `cli2`

- **Statut** : accepté
- **Date** : 2026-10-08
- **Décideurs** : responsable du POC

## Contexte

À terme, chaque client consultera **son** projet ainsi que le tronc commun (`core` et `common`), et jamais le projet d'un autre client. Pour le POC, un seul dépôt git suffit, mais l'organisation doit anticiper cette séparation : au minimum, un répertoire de premier niveau pour le tronc commun et un par client.

## Options considérées

### A. Un répertoire de premier niveau par futur dépôt (`socle/`, `cli1/`, `cli2/`)

- Avantages : la séparation future se fait par simple extraction de répertoire ; les dépendances interdites (cli1 → cli2) se voient immédiatement.
- Inconvénients : il faut un liant à la racine (Makefile, README) qui n'appartiendra à aucun dépôt. Compose résout les chemins depuis `socle/`, d'où des chemins `../cliN`.

### B. Monorepo durable, organisé par couche (`backend/`, `frontend/`)

- Avantages : structure classique, outillage simple.
- Inconvénients : le code des clients se mélange par couche, la séparation des droits devient impossible, et l'extraction future demande un vrai chantier.

### C. Un dépôt par module dès maintenant (`core`, `common`, `cli1`…)

- Avantages : séparation réelle.
- Inconvénients : il faut un registre de paquets et une gestion de versions avant même d'avoir validé l'architecture. Coût disproportionné pour un POC.

## Décision

Option A :

- `socle/` regroupe le backend (`core`, `common`, hôte Laravel), le frontend (`@archi/core-ui`), la composition de base et la surcharge de la solution 2 ;
- `cliN/` contient le paquet backend du client, son application front et sa surcharge Compose `compose-cliN.yaml` ;
- aucun fichier de `cliN/` ne référence un autre client.

## Conséquences

- Le contrôle `rg -l cli2 cli1/` doit rester vide, et inversement.
- Le code client n'entre dans les builds que par un contexte nommé ([ADR 0004](0004-une-image-par-cible.md)).
- Au découpage :
  - le socle sera publié sous forme de paquets ([ADR 0010](0010-resolution-des-dependances-au-build.md)) ;
  - un dépôt client récupérera le socle en sous-module ou en clone voisin, ce qui conserve les chemins `../cliN` de Compose ;
  - le liant racine (Makefile, README) devra trouver sa place, probablement dans le socle.
