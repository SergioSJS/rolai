# 03 — frontend web

## Objetivo

PWA em React + Vite + TS que integra `rules-engine` (etapa 01) com
`dice-box`/`dice-box-threejs` pro render 3D, e conecta no backend real
(etapa 02) quando o usuário estiver numa sala. Esta é a etapa que valida
o conceito fim-a-fim — teste manual com duas abas do navegador na mesma
sala deve mostrar rolagem sincronizada.

## Escopo

- Tela de rolagem: seleção de profile (ou notação freeform), inputs
  dinâmicos conforme o profile escolhido (ver `docs/system-profiles.md`),
  botão de rolar.
- Escada de qualidade de render configurável pelo usuário (3D completo /
  3D leve / 2D / texto puro — ver `docs/architecture.md`), persistida em
  `localStorage`.
- Fluxo de sala: criar sala, entrar por código/link, ver roster, ver
  histórico ao vivo, exportar (chama o endpoint de export do backend).
- Modo sem sala funcional por padrão — rolar sem nunca ter tocado em
  criar/entrar em sala.
- Modo stream pra Browser Source do OBS via URL própria
  (`?room=CÓDIGO&stream=1`, fundo alpha; `&chroma=rrggbb` pra chroma key) —
  cliente espectador, sem UI de app, resultado com fade-out (ver
  `docs/handoff.md`).
- Manifest PWA correto (`display: standalone`, ícones, etc) — precisa
  instalar como PWA no Android pra a etapa 04 poder envelopar via TWA.

## Fora de escopo nesta etapa

- Qualquer coisa nativa Android — isso é `apps/android` (etapa 04).
- Autenticação — não existe.

## Critérios de aceite

- `npm test` (vitest) cobre lógica de componente que não seja só render
  (ex: seleção de tier de qualidade, montagem de payload a partir dos
  inputs do profile).
- Teste manual documentado no PR: duas abas na mesma sala, rolar em uma,
  confirmar que a outra recebe e anima o mesmo resultado.
- Lighthouse PWA check básico passa (installable, manifest válido).
- Fundo transparente testado de fato num Browser Source do OBS (ou
  screenshot comparando com/sem, documentado no PR).
