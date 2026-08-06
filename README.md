# Rolaí

Dice roller 3D multiplayer para mesas de RPG — salas efêmeras, histórico
exportável, e um app Android com botão flutuante pra rolar sem sair de
outro app.

## Começando

Se você é um agente de codificação (Kimi Code, Claude Code): comece por
`AGENTS.md`, depois `specs/00-overview.md`.

Se você é humano: comece por `docs/architecture.md` — tem o desenho
completo do sistema, as decisões já tomadas e o porquê de cada uma.

## Estrutura

| Pasta | O quê |
|---|---|
| `packages/rules-engine` | Parser de notação + profiles de sistema (TS, compartilhado web/Android) |
| `apps/web` | Frontend PWA (React + Vite + TS) |
| `apps/android` | App Kotlin (TWA + overlay flutuante) |
| `services/backend` | Relay de sala (FastAPI) |
| `infra` | Docker Compose para Hostinger e ZimaOS/CasaOS |
| `docs` | Arquitetura, notação de rolagem, profiles, segurança, deploy |
| `specs` | Specs de implementação por etapa (estilo SPDD) |

## Deploy

Dois alvos suportados desde o início, ver `docs/deployment.md`:

- **Hostinger VPS** — atrás do Traefik existente, `infra/docker-compose.hostinger.yml`
- **ZimaOS/CasaOS** — `infra/docker-compose.casaos.yml` + manifest em `infra/casaos/`
