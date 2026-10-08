# Usage : make up [CLIENT=cli1|cli2] [SOLUTION=1|2] [DEV=0|1]
#   SOLUTION=1 : API common + API du client (séparées)
#   SOLUTION=2 : API du client incluant common
#   DEV=1      : mode développement (Vite HMR, sources PHP montées)
export CLIENT ?= cli1
SOLUTION ?= 1
DEV      ?= 0

export COMPOSE_FILE := socle/compose.yaml:$(CLIENT)/compose-$(CLIENT).yaml$(if $(filter 2,$(SOLUTION)),:socle/compose-standalone.yaml)$(if $(filter 1,$(DEV)),:socle/compose-dev.yaml)

# Empreinte des sources du client, passée en argument de build : le cache de
# Compose ignore les modifications des contextes nommés (additional_contexts),
# cette valeur l'invalide quand le client change (cf. ADR 0004).
export CLIENT_REV := $(shell find $(CLIENT) -type f -not -path '*/node_modules/*' -not -path '*/dist/*' -exec sha256sum {} + | sort | sha256sum | cut -c1-12)

.PHONY: up down ps logs config test

# Une seule combinaison déployée à la fois : up repart de zéro (down).
up: down
	docker compose up -d --build --wait

# --profile "*" : retire aussi api-common, désactivé par profil en solution 2
down:
	docker compose --profile "*" down --remove-orphans

ps:
	docker compose ps

logs:
	docker compose logs -f

config:
	docker compose config

test:
	curl -fsS http://localhost:8080/api/common/hello; echo
	curl -fsS http://localhost:8080/api/$(CLIENT)/hello; echo
