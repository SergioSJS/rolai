# PWA estatica servida por nginx. O build e multi-stage: o Vite roda no
# estagio node (precisa do monorepo inteiro — o app importa
# @rolai/rules-engine por workspace) e so o dist/ vai pra imagem final.
FROM node:20-alpine AS build
WORKDIR /repo

# Fallback de build. O caminho normal e a env de RUNTIME (ROLAI_WS_URL, via
# entrypoint) — esta ARG so define o que o bundle usa se o container subir
# sem essa env.
ARG VITE_WS_URL=
ARG VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json ./
COPY packages/rules-engine/package.json packages/rules-engine/
COPY packages/deck-engine/package.json packages/deck-engine/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY packages/rules-engine packages/rules-engine
COPY packages/deck-engine packages/deck-engine
COPY apps/web apps/web
RUN npm run build -w @rolai/web

FROM nginx:1.27-alpine
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY infra/web-entrypoint.sh /docker-entrypoint.d/99-rolai-config.sh
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80

# Reescreve /config.js com as envs a cada start e entrega pro nginx.
ENTRYPOINT ["/docker-entrypoint.d/99-rolai-config.sh"]
