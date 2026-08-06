# Profiles de sistema (camada 2 — semântica)

Um profile diz o que os grupos da notação **significam** pra um sistema
específico: quais campos pedir do jogador, como montar a notação a partir
deles, e como interpretar o resultado em `outcome_rules`.

Profiles ficam em `packages/rules-engine/profiles/*.yaml`, versionados no
repo — não são dado de usuário (isso é diferente de um profile custom que
o próprio usuário cria e salva, que aí sim vai pro Postgres, ver
`docs/architecture.md`).

## Schema

```yaml
system: string              # id único, usado na invocação (`ironsworn`, `pbta`, ...)
label: string                # nome pra exibir na UI
roll_type: simple | comparison
inputs:                       # campos que a UI precisa pedir ao jogador
  - id: string
    label: string
    type: number | select
    options:                  # obrigatório em `select`; string ou {value,label}
      - { value: "adv", label: "Vantagem" }
fields:
  - id: string
    dice: string              # notação camada 1, pode referenciar {input.id}
    modifier: string | null   # referência a um input, se houver
    compare_individually: bool # true = mantém array, false = soma (default)
outcome_rules:                 # avaliadas em ordem, primeira que bater vence
  - condition: string          # expressão sobre os ids de `fields` e {input.id}
    result: string              # label do outcome
```

`select` só aceita, na rolagem, um dos `value` declarados — o valor é
interpolado cru na notação (`"1d20{input.mode}"` -> `1d20adv`), então não pode
vir texto arbitrário do cliente.

As `condition` também interpolam `{input.id}` antes de avaliar. É o que
permite dificuldade/CD/perícia serem dado do jogador em vez de constante do
sistema (`"roll.total >= {input.dc}"`). Na validação do schema o placeholder
vira `0` só pra checar a sintaxe; o valor real entra na rolagem.

## Exemplo — Ironsworn (comparação elemento a elemento + evento independente)

```yaml
system: ironsworn
label: "Ironsworn — Ação"
roll_type: comparison
inputs:
  - id: attribute
    label: "Atributo"
    type: number
fields:
  - id: action
    dice: "1d6"
    modifier: "{input.attribute}"
  - id: challenge
    dice: "2d10"
    compare_individually: true
outcome_rules:
  - condition: "action.total > challenge[0] and action.total > challenge[1]"
    result: strong_hit
  - condition: "action.total > challenge[0] xor action.total > challenge[1]"
    result: weak_hit
  - condition: "action.total <= challenge[0] and action.total <= challenge[1]"
    result: miss
  - condition: "challenge[0] == challenge[1]"     # independe do hit/miss acima
    result: match
```

## Exemplo — Powered by the Apocalypse (soma simples, tiers)

```yaml
system: pbta
label: "PbtA — Rolagem 2d6"
roll_type: simple
inputs:
  - id: mod
    label: "Modificador"
    type: number
fields:
  - id: roll
    dice: "2d6"
    modifier: "{input.mod}"
outcome_rules:
  - condition: "roll.total >= 10"
    result: strong_hit
  - condition: "roll.total >= 7 and roll.total < 10"   # tiers exclusivos
    result: weak_hit
  - condition: "roll.total < 7"
    result: miss
```

> Tiers em cascata devem ser escritos **mutuamente exclusivos** (como no
> `weak_hit` acima). Sem isso, um `strong_hit` também marca `weak_hit` e o
> `outcome_flags` carrega dois tiers contraditórios — flags existem pra
> eventos independentes (o `match` do Ironsworn), não pra ecoar o tier.

## Exemplo — Forged in the Dark (pool de sucessos)

```yaml
system: fitd
label: "FitD — Pool de ação"
roll_type: simple
inputs:
  - id: pool_size
    label: "Tamanho do pool"
    type: number
fields:
  - id: pool
    dice: "{input.pool_size}d6"
outcome_rules:
  - condition: "count(pool, '>=6') >= 2"
    result: critical
  - condition: "count(pool, '>=6') == 1"
    result: full_success
  - condition: "max(pool) >= 4 and count(pool, '>=6') == 0"
    result: partial_success
  - condition: "max(pool) < 4"
    result: miss
```

## Invocação (camada de UI/atalho)

A UI não precisa expor a notação bruta — monta a partir do profile e dos
inputs. A forma textual serve como formato de log e via de entrada rápida:

```
ironsworn attribute=2
pbta mod=1
fitd pool_size=4
2d6+3                    -- freeform, sem profile, sem outcome
```

## Testes obrigatórios pra qualquer profile novo

Todo profile em `packages/rules-engine/profiles/` precisa de um arquivo de
teste correspondente em `packages/rules-engine/test/profiles/` cobrindo
pelo menos: um caso de cada `outcome_rule`, e o caso de borda de empate
(quando aplicável, como o `match` do Ironsworn).
