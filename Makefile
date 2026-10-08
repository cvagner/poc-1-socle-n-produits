# Usage : make up [CLIENT=cli1|cli2] [SOLUTION=1|2]
#   SOLUTION=1 : API common + API du client (séparées)
#   SOLUTION=2 : API du client incluant common
CLIENT   ?= cli1
SOLUTION ?= 1

export COMPOSE_FILE := socle/compose.yaml:$(CLIENT)/compose-$(CLIENT).yaml$(if $(filter 2,$(SOLUTION)),:socle/compose-standalone.yaml)

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
