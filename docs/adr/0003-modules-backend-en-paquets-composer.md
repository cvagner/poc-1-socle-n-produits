# ADR 0003 : modules backend en paquets Composer Laravel auto-découverts

- **Statut** : accepté
- **Date** : 2026-10-08
- **Décideurs** : responsable du POC

## Contexte

Le backend Laravel se compose de `core` (utilisé par tous, non déployé seul), de `common` et de `cli1`/`cli2` (qui s'appuient tous sur `core`). Selon la solution de déploiement, une même API embarque un ou plusieurs de ces modules ([ADR 0005](0005-deux-topologies-par-surcharge-compose.md)).

## Options considérées

### A. Un paquet Composer par module, avec un ServiceProvider découvert automatiquement

- Avantages :
  - dépendances explicites (`archi/cliN` requiert `archi/core`) ;
  - assemblage déclaratif : installer un paquet suffit à activer ses routes ;
  - même mécanisme que la future distribution par registre privé.
- Inconvénients : une application hôte est nécessaire ; les versions des paquets sont à gérer.

### B. Modules internes à une seule application (namespaces et répertoires)

- Avantages : le plus simple à écrire.
- Inconvénients : tout le code de tous les clients se trouve dans le même arbre, ce qui rend impossible la séparation des dépôts ([ADR 0002](0002-decoupage-en-futurs-depots.md)). L'activation se fait par configuration.

### C. Micro-services indépendants (une application Laravel complète par module)

- Avantages : isolation maximale.
- Inconvénients : `core` est dupliqué ou vendu dans chaque application, et la solution 2 (common inclus dans l'API client) est impossible sans fusion.

## Décision

Option A :

- `archi/core` (`socle/backend/packages/core`) fournit :
  - `ModuleRegistry`, la liste des modules chargés ;
  - `ModuleServiceProvider`, la classe de base des modules, qui déclare le module et monte ses routes sous `/api/<module>` avec le middleware `api` ;
  - `Http\ApiResponse`, le format de réponse commun `{ module, message, served_by, modules_loaded }`.
- `archi/common`, `archi/cli1` et `archi/cli2` héritent de `ModuleServiceProvider` et se déclarent via `extra.laravel.providers`.
- L'hôte `socle/backend/host` est un squelette Laravel 13 élagué : sans vues, base de données ni routes propres, hormis la sonde `/up`. Il requiert seulement `archi/core` et voit les paquets par un dépôt Composer de type `path` (`../packages/*`, `symlink: false`).
- Les paquets portent une version explicite (`0.1.0`) pour que les contraintes `^0.1` se résolvent sans dépôt git.

## Conséquences

- Ajouter un client revient à créer un paquet `archi/cliN` et une surcharge Compose, sans toucher au socle.
- `core` ne peut pas exposer de route métier, puisqu'il est présent dans toutes les API.
- Le champ `version` des paquets devra disparaître au profit des tags git quand le socle sera publié dans un registre.
