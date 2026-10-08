
Ce projet est un POC qui a pour objectifs de démontrer la faisabilité et comment d'une évosystème avec tronc commun et services (au sens large) spécifiques.
0bjectifs :
* backend :
  * sources :
    * `core` qui sera utilisé par les autres (pas vocation à être déployé)
    * `common` (s'appuie sur `core`)
    * `cli1` pour services spécifiques à cli1 (s'appuie sur `core`)
    * `cli2` pour services spécifiques à cli2 (s'appuie sur `core`)
  * RUN :
    * Solution 1 : api `common` + api `cli1` ou bien api `common` + api `cli2`
    * Solution 2 : api `cli1` avec common inclus ou bien api `cli2` avec common inclus
* frontend :
  * sources :
    * composants `core` et 2 fronts finaux `cli1` et `cli2`
  * RUN :
    * frontend `cli1` ou bien frontend `cli2`

Techno :
* backend : php Laravel
* frontend : react
* docker avec compose (2 compositions : un fichier `compose.yaml` de base + un fichier `compose-cli<1 ou 2>.yaml` qui complètera avec une variable `COMPOSE_FILE="compose.yaml:compose-cli1.yaml"` par exemple)
* makefile (le plus simple possible)

Simplicité :
- pas d'authentification
- web services très simplistes : 1 common, 1 cli1, 1 cli2 en GET suffisent
- frontaux : 2 écrans

Construisons l'architecture.
