#!/bin/sh
# Escreve a config de runtime da PWA e sobe o nginx.
#
# A URL do backend NAO fica inlinada no bundle: o app le
# window.__ROLAI_CONFIG__ (ver apps/web/src/config.ts), entao a mesma imagem
# serve qualquer dominio — basta trocar a env e reiniciar o container.
set -e

escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

cat > /usr/share/nginx/html/config.js <<EOF
window.__ROLAI_CONFIG__ = {
  wsUrl: "$(escape "${ROLAI_WS_URL:-}")",
  apiUrl: "$(escape "${ROLAI_API_URL:-}")"
};
EOF

exec nginx -g 'daemon off;'
