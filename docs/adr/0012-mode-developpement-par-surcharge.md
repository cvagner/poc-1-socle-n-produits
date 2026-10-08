# ADR 0012 : mode développement par surcharge Compose

- **Statut** : accepté
- **Date** : 2026-10-08
- **Décideurs** : responsable du POC

## Contexte

En mode normal, toute modification d'un client ou du socle impose `make up` : reconstruction des images, `composer update` et `npm install`, puis redémarrage. Pour développer, il faut voir les modifications immédiatement :
- front : serveur Vite avec rechargement à chaud (HMR) ;
- API : code PHP relu sans reconstruction.

Le tout doit rester servi par la passerelle ([ADR 0011](0011-passerelle-nginx-dediee.md)), dans les 4 combinaisons client × solution. Le plan est consigné dans [docs/plan_02_dev.md](../plan_02_dev.md).

## Options considérées

### A. Surcharge `socle/compose-dev.yaml`, ajoutée en dernier à `COMPOSE_FILE`

- Avantages :
  - même mécanisme que la solution 2 ([ADR 0005](0005-deux-topologies-par-surcharge-compose.md)) ;
  - un seul fichier, indépendant du client grâce à `${CLIENT}` ;
  - la composition de production reste intacte.
- Inconvénients : la variable `CLIENT` doit être fournie, ce que fait le Makefile ; lancée seule, la surcharge échoue avec un message explicite.

### B. Profils `dev` dans `compose.yaml`

- Avantages : un fichier de moins.
- Inconvénients : la configuration de développement se mêle à celle de production, et les services de dev doublonnent ceux de prod.

### C. Un fichier de dev par client (`cliN/compose-cliN-dev.yaml`)

- Avantages : aucune variable.
- Inconvénients : configuration dupliquée par client, alors que seuls les chemins changent.

### D. Développement hors conteneur (Vite et PHP sur le poste)

- Avantages : outillage natif.
- Inconvénients : PHP n'est pas installé sur le poste ; s'écarte du principe « Docker seulement » du POC ; l'environnement diffère de la cible.

## Décision

Option A. `make up DEV=1` ajoute `:socle/compose-dev.yaml` à `COMPOSE_FILE`.

**Front** :
- étape `dev` du Dockerfile, dont les `node_modules` sont installés dans l'image. L'étape de build de production en hérite (`FROM dev AS build`), si bien que les dépendances sont les mêmes ;
- serveur Vite (`vite --host 0.0.0.0 --port 8080 --strictPort --configLoader runner`) ;
- sources montées en lecture seule, **par répertoire** et jamais fichier par fichier : `core-ui/src` et le répertoire `cliN/frontend` entier ;
- cache de Vite déplacé dans `/tmp/vite` (tmpfs) par `VITE_CACHE_DIR`, lue par le `vite.config.js` des clients (`cacheDir: process.env.VITE_CACHE_DIR`). Sans la variable, Vite garde sa valeur par défaut, et la production est inchangée ;
- limites 1 CPU / 512 Mio.

**Passerelle** : la `location /` relaie les WebSocket (`Upgrade`/`Connection`) et transmet l'en-tête `Host` d'origine, que Vite exige. C'est sans effet en production.

**API** :
- sources des paquets montées en lecture seule sur `/app/vendor/archi/{core,common,cliN}`, à la place des copies installées au build ;
- opcache revalide les fichiers (`validate_timestamps=On`, `revalidate_freq=2`, valeurs vérifiées dans l'image) ;
- `APP_ENV=local` et `APP_DEBUG=true`.

Le durcissement est inchangé : UID 10001, `read_only`, sondes.

## Conséquences

Vérifié le 2026-10-08 :

- **Configurations** : `make config` est valide sur les 8 combinaisons (client × solution × DEV).
- **Rechargement à chaud** : à travers la passerelle, un WebSocket `vite-hmr` s'établit (`101 Switching Protocols`). Une modification de `cli2/frontend/src/Cli2Screen.jsx` envoie un message `update` ; une modification de `core-ui/src/CommonScreen.jsx` est également prise en compte, comme le confirment des captures.
- **PHP** : une modification de `cli2/backend/routes/api.php` ou de `socle/backend/packages/common/routes/api.php` est visible en moins de 3 s, en solution 1 (`api-common`) comme en solution 2 (`api`).
  - Une **nouvelle classe** (`Archi\Cli2\Sonde`) est chargée sans reconstruction : le classmap optimisé se rabat sur PSR-4.
- **Durcissement** : `front` et `api` tournent sous l'UID 10001, avec écriture refusée hors tmpfs. Vite consomme environ 300 Mio.
- **Non-régression** : `make up` sans `DEV` sert toujours le build nginx de production.
- **Modifications faites sur l'hôte** (IDE, éditeur) :
  - le `:ro` d'un montage n'interdit que les écritures depuis le conteneur. Les fichiers de l'hôte sont vus directement ;
  - Vite est notifié par inotify, car hôte et conteneur partagent le noyau sous Linux avec Docker natif ;
  - PHP revalide la date de modification des fichiers (opcache) ;
  - **un fichier monté seul ne suit pas un enregistrement atomique** (fichier temporaire puis renommage, comme dans JetBrains en « safe write » ou vim selon la configuration). Le montage reste attaché à l'ancien inode. Vérifié : un fichier monté seul garde l'ancienne version après `sed -i`, alors qu'un répertoire monté montre la nouvelle. D'où le montage de `cliN/frontend` en entier, qui remplace les montages initiaux de `src/` et `index.html`. Vérifié ensuite en dev : `index.html` et un `.jsx` modifiés par `sed -i` sont servis à jour, et une modification de `vite.config.js` redémarre le serveur Vite (« vite.config.js changed, restarting server ») ;
  - avec Docker Desktop (macOS, Windows), les fichiers traversent la machine virtuelle et la propagation des notifications est moins sûre. Le remède serait `server.watch.usePolling`, inutile sous Linux.
- **Corrections apportées pendant la mise au point** :
  - la sonde vise `127.0.0.1`, car `localhost` résout en `::1` alors que Vite n'écoute qu'en IPv4.
- **Limites** : il faut repasser par `make up DEV=1` pour :
  - une dépendance (`composer.json`, `package.json`) ;
  - un nouveau paquet ou un nouveau fournisseur de service (découverte Laravel au build) ;
  - l'hôte Laravel (`socle/backend/host`).
- **Port HMR** : le port du WebSocket côté navigateur est celui de Vite (8080), identique au port publié par défaut. Avec un autre `HTTP_PORT`, il faudrait régler `server.hmr.clientPort`.
- **En solution 1**, le montage de `common` dans `api` est inerte : le paquet n'est pas déclaré dans `bootstrap/cache/packages.php`.
- **Hook de validation Compose** : un hook qui valide la surcharge avec la seule base, sans fichier client ni `CLIENT`, signale `required variable CLIENT is missing a value`. C'est voulu : une valeur par défaut risquerait de monter les sources d'un autre client.
