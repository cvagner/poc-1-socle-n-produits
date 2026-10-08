# ADR 0010 : résolution des dépendances au build (compromis du POC)

- **Statut** : accepté
- **Date** : 2026-10-08
- **Décideurs** : responsable du POC

## Contexte

L'ensemble des paquets installés dépend de la cible :

- backend : core seul, core + common, core + cliN, ou core + common + cliN ;
- front : le workspace contient l'application du client injectée au build.

Un fichier lock unique ne peut donc pas décrire toutes les cibles. Dans le POC, les paquets internes sont fournis par des dépôts locaux (`path` Composer, workspace npm), pas par un registre.

## Options considérées

### A. Résoudre au build, sans lock versionné

- Avantages : aucun fichier lock à maintenir par combinaison ; immédiat pour un POC.
- Inconvénients : builds non reproductibles, car une nouvelle version mineure d'une dépendance tierce peut entrer d'un build à l'autre.

### B. Versionner un lock par cible (`composer.lock`, `package-lock.json`)

- Avantages : builds reproductibles.
- Inconvénients : il faut générer et maintenir autant de locks que de combinaisons, avec un outillage de synchronisation, avant même de valider l'architecture.

### C. Publier le socle dans des registres privés, chaque dépôt client versionnant son propre lock

- Avantages : la cible naturelle, reproductible, alignée sur la séparation des dépôts.
- Inconvénients : il faut un registre Composer (Satis ou registre de paquets GitLab) et un registre npm, ainsi qu'une gestion de versions sémantiques du socle.

## Décision

Option A pour le POC :

- `composer require` et `composer update` dans l'étape de build de l'API ;
- `npm install` dans l'étape de build du front ;
- `composer.lock` et `package-lock.json` exclus de git et du contexte Docker.

Les versions directes sont bornées dans les manifestes :

- `laravel/framework ^13.17` ;
- `react ^19.3.0`, `react-router ^8.4.0`, `vite ^8.3.4`.

Les images de base sont épinglées à une version exacte.

## Conséquences

- Deux builds successifs peuvent différer sur des versions mineures ou correctives de dépendances tierces. C'est acceptable pour un POC, pas pour la production.
- La trajectoire retenue est l'option C au moment de la séparation des dépôts ([ADR 0002](0002-decoupage-en-futurs-depots.md)) :
  - `archi/core` et `archi/common` publiés dans un registre Composer privé, `@archi/core-ui` dans un registre npm privé ;
  - chaque dépôt client versionne le lock de ses propres cibles ;
  - les dépôts `path` et le workspace d'assemblage disparaissent.
