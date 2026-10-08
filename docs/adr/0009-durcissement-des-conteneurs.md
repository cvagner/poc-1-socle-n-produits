# ADR 0009 : durcissement des conteneurs

- **Statut** : accepté
- **Date** : 2026-10-08
- **Décideurs** : responsable du POC

## Contexte

Les compositions Docker de l'équipe suivent des conventions communes :

- exécution non root sous un UID/GID arbitraire ;
- système de fichiers en lecture seule, avec des tmpfs pour les zones inscriptibles ;
- limites CPU et mémoire explicites ;
- sondes de santé.

Un POC destiné à servir de modèle doit les appliquer d'emblée.

## Options considérées

### A. Appliquer les conventions à chaque service

- Avantages : le POC sert de modèle, et les incompatibilités (écritures inattendues) sont découvertes tôt.
- Inconvénients : quelques réglages propres à chaque image à identifier.

### B. Garder les valeurs par défaut des images

- Avantages : aucun effort.
- Inconvénients : exécution en root (FrankenPHP, vérifié avec `id`), système de fichiers inscriptible, aucune limite. Ce serait un mauvais modèle.

## Décision

Option A, factorisée par l'ancre `x-api` de `socle/compose.yaml` pour les API.

| Réglage | API (`api-common`, `api`) | Front | Passerelle (`gateway`) |
|---|---|---|---|
| Utilisateur | `${APP_UID:-10001}:${APP_GID:-10001}` | idem | idem |
| `read_only` | `true` | `true` | `true` |
| tmpfs | `/tmp`, `/app/storage/framework/views:mode=1777`, `/app/storage/framework/cache:mode=1777` | `/tmp` | `/tmp` |
| Limites | 0,5 CPU, 256 Mio | 0,25 CPU, 64 Mio | 0,25 CPU, 64 Mio |
| Sonde | `curl -fsS http://localhost:8000/up` | `curl -fsS http://localhost:8080/` | `curl -fsS http://localhost:8080/healthz` |
| Exposition | aucune | aucune | `127.0.0.1:${HTTP_PORT:-8080}` |

Mise à jour du 2026-10-08 ([ADR 0011](0011-passerelle-nginx-dediee.md)) : ajout de la passerelle. Le port publié passe du front à la passerelle (`FRONT_PORT` devient `HTTP_PORT`). Le front n'a plus de tmpfs sur `/etc/nginx/conf.d`, car sa configuration est désormais copiée dans l'image.

Les fichiers des images appartiennent à root et sont lisibles par tous (`chmod -R a+rX` au build), si bien que n'importe quel UID peut les lire.

## Conséquences

- **Vérifié** : un tmpfs sans option monté sur un répertoire qui **existe déjà dans l'image** en reprend le mode. C'est le cas de `storage/framework/views` : 755, appartenant à root. Un point de montage neuf, comme `/tmp`, est créé en 1777. Sans option, l'UID 10001 ne pouvait donc pas écrire dans `views` : `/up` répondait 500, avec l'erreur « tempnam(): file created in the system's temporary directory » à la compilation de la vue de santé. D'où le `mode=1777` explicite sur ces tmpfs.
- **Vérifié** : `docker compose exec api id` renvoie `uid=10001`, et `touch /app/x` échoue avec `Read-only file system`. Même résultat dans le front.
- Les journaux Laravel partent sur la sortie d'erreur (`LOG_CHANNEL=stderr`) : aucun besoin d'écrire dans `storage/logs`.
- Les limites sont indicatives pour un POC et seront à recalibrer sous charge réelle.
