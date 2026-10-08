# syntax=docker/dockerfile:1

# Image d'une API : l'hôte Laravel du socle + archi/core, plus les modules
# choisis au build :
#   COMMON=true  -> ajoute archi/common
#   CLIENT=cliN  -> ajoute archi/cliN, fourni par le contexte nommé « client »
#                   (compose : build.additional_contexts.client)
# Le code d'un client n'entre dans le build que par ce contexte nommé.

ARG FRANKENPHP_IMAGE=dunglas/frankenphp:1.13.0-php8.5-alpine

# Contexte nommé « client » : vide par défaut (cas de l'API common), remplacé
# par le paquet du client quand compose le fournit.
FROM scratch AS client

FROM ${FRANKENPHP_IMAGE} AS build
COPY --from=composer:2.10.3 /usr/bin/composer /usr/bin/composer
# unzip : extraction des archives des dépendances (pas d'extension zip dans l'image)
RUN apk add --no-cache unzip

ARG COMMON=false
ARG CLIENT=
ENV COMPOSER_HOME=/tmp/composer

COPY packages/ /src/packages/

# Contournement : avec Compose (constaté en v5.6.0, BuildKit v0.33.1), le cache
# de COPY --from=client ignore les modifications du contexte nommé et l'image
# garderait une ancienne version du paquet client. CLIENT_REV, empreinte des
# sources du client calculée par le Makefile, invalide le cache quand elles
# changent (cf. ADR 0004).
ARG CLIENT_REV=
RUN echo "Sources client : ${CLIENT_REV:-non renseignée}"
COPY --from=client / /src/packages/client/
COPY host/ /src/host/
WORKDIR /src/host

RUN set -eu; \
    modules=""; \
    if [ "$COMMON" = "true" ]; then modules="$modules archi/common:^0.1"; fi; \
    if [ -n "$CLIENT" ]; then modules="$modules archi/$CLIENT:^0.1"; fi; \
    if [ -n "$modules" ]; then composer require --no-update $modules; fi; \
    composer update --no-dev --no-interaction --no-progress --optimize-autoloader; \
    chmod -R a+rX /src/host

FROM ${FRANKENPHP_IMAGE}

# Exécution sous un UID arbitraire, système de fichiers en lecture seule :
# Caddy écrit sa configuration et ses données sous /tmp (tmpfs).
ENV SERVER_NAME=:8000 \
    XDG_CONFIG_HOME=/tmp/caddy/config \
    XDG_DATA_HOME=/tmp/caddy/data \
    APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    SESSION_DRIVER=array \
    CACHE_STORE=array

COPY --from=build /src/host /app
EXPOSE 8000
