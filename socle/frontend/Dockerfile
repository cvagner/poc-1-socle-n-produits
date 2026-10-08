# syntax=docker/dockerfile:1

# Image du front d'un client : workspace du socle (@archi/core-ui) + appli du
# client, fournie par le contexte nommé « client » (compose :
# build.additional_contexts.client) et copiée dans apps/client.

FROM node:24.21.0-alpine AS build
WORKDIR /src
COPY package.json ./
COPY packages/ packages/

# Contournement : avec Compose (constaté en v5.6.0, BuildKit v0.33.1), le cache
# de COPY --from=client ignore les modifications du contexte nommé. CLIENT_REV,
# empreinte des sources du client calculée par le Makefile, invalide le cache
# quand elles changent (cf. ADR 0004).
ARG CLIENT_REV=
RUN echo "Sources client : ${CLIENT_REV:-non renseignée}"
COPY --from=client / apps/client/
RUN npm install --no-audit --no-fund
RUN npm run build --workspace apps/client

FROM nginxinc/nginx-unprivileged:1.30.5-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/apps/client/dist /usr/share/nginx/html
EXPOSE 8080
