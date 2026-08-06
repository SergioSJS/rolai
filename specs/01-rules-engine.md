# 01 — rules-engine

## Objetivo

Implementar `packages/rules-engine` como pacote TypeScript standalone,
sem nenhuma dependência de rede, DOM, ou renderização. Deve rodar tanto no
browser (importado por `apps/web`) quanto numa WebView headless Android.

## Escopo

- Parser de notação camada 1 (`docs/roll-notation.md`): pool simples,
  modificador, keep/drop, reroll condicional, e o operador de grupos
  `{...} vs {...}`.
- Carregamento de profiles YAML (`docs/system-profiles.md`) e avaliação de
  `outcome_rules` contra um avaliador de expressão **restrito** — não usar
  `eval`/`Function()` de JS puro (ver `docs/security.md`, mesmo rodando
  local isso evita que um profile custom malicioso injete algo inesperado).
- RNG: usar uma fonte injetável (parâmetro opcional), default
  `crypto.getRandomValues` — nunca `Math.random()` puro, pra manter
  qualidade de aleatoriedade consistente entre ambientes.
- Suporte a "resultado determinístico": a função de roll aceita um valor
  final opcional por dado, pra permitir que o renderer 3D anime uma queda
  visualmente aleatória convergindo pro valor já decidido (uso: replay de
  um resultado recebido via WS).
- Os três profiles de exemplo de `docs/system-profiles.md` (Ironsworn,
  PbtA, FitD) implementados e testados.

## Fora de escopo nesta etapa

- Qualquer coisa de UI, rede, ou persistência.
- Renderização 3D (isso é `apps/web`).

## Critérios de aceite

- `npm test` em `packages/rules-engine` cobre: cada operador de notação
  isoladamente, o operador de grupo com pelo menos um caso de comparação
  elemento-a-elemento, e os três profiles de exemplo com pelo menos um
  caso por `outcome_rule` cada (ver exigência de teste em
  `docs/system-profiles.md`).
- A saída de qualquer rolagem bate exatamente com o contrato `RollResult`
  definido em `docs/roll-notation.md`.
- O pacote não importa nada de DOM (`window`, `document`) no caminho de
  cálculo — só no que for exclusivamente de apresentação, se houver.
