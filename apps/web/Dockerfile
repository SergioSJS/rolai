# PWA estatica servida por nginx. O build e multi-stage: o Vite roda no
# estagio node (precisa do monorepo inteiro — o app importa
# @rolai/rules-engine por workspace) e so o dist/ vai pra imagem final.
FROM node:20-alpine AS build
WORKDIR /repo

# A URL do backend entra em tempo de BUILD (Vite inlina no bundle), nao em
# runtime — por isso vem como build-arg e nao como env do container.
ARG VITE_WS_URL=wss://api.rolai.app
ARG VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json ./
COPY packages/rules-engine/package.json packages/rules-engine/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY packages/rules-engine packages/rules-engine
COPY apps/web apps/web
RUN npm run build -w @rolai/web

FROM nginx:1.27-alpine
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
