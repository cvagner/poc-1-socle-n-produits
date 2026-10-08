# syntax=docker/dockerfile:1

# Image du front d'un client : workspace du socle (@archi/core-ui) + appli du
# client, fournie par le contexte nommé « client » (compose :
# build.additional_contexts.client) et copiée dans apps/client.

FROM node:24.21.0-alpine AS build
WORKDIR /src
COPY package.json ./
COPY packages/ packages/
COPY --from=client / apps/client/
RUN npm install --no-audit --no-fund
RUN npm run build --workspace apps/client

FROM nginxinc/nginx-unprivileged:1.30.5-alpine
# Rendu par envsubst au démarrage dans /etc/nginx/conf.d (tmpfs en lecture seule)
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /src/apps/client/dist /usr/share/nginx/html
EXPOSE 8080
