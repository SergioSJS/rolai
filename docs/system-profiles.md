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
roll_type: simple | comparison | multi | overlay
inputs:                       # campos que a UI precisa pedir ao jogador
  - id: string
    label: string
    type: number | select
    required: bool            # default true; false = pode ficar em branco
    default: string           # opcional: valor pre-preenchido no formulario
    options:                  # obrigatório em `select`; string ou {value,label}
      - { value: "adv", label: "Vantagem" }
fields:
  - id: string
    dice: string              # notação camada 1, pode referenciar {input.id}
    modifier: string | null   # referência a um input, se houver
    compare_individually: bool # true = mantém array, false = soma (default)
    success_rule: string | null # ex. ">=5" — total vira CONTAGEM, não soma
outcome_rules:                 # avaliadas em ordem, primeira que bater vence
  - condition: string          # expressão sobre os ids de `fields` e {input.id}
    result: string              # label do outcome
```

`roll_type` define quantos `fields` o profile exige e como a notação final é
montada:

- `simple`: exatamente 1 field. Notação crua (`"2d6+1"`).
- `comparison`: exatamente 2 fields que competem entre si (ação vs desafio).
  Notação `"{a} vs {b}"` — ver Ironsworn (`{1d6+mod} vs {2d10}`) e Firelights
  (`{2d6+mod} vs {2c}`).
- `multi`: 2 ou mais fields **independentes** (não competem). Notação
  `"{a} + {b}"` — ex: dado regular + dado de Fome/Ira do WoD5, ou o par
  verbo/substantivo do oráculo de ideias do Infaernum.
- `overlay`: **zero** fields — o profile não rola dado próprio. As
  `outcome_rules` são avaliadas sobre uma rolagem que já aconteceu por
  fora (o composer de notação livre normal). Usar `rollOverlay`, nunca
  `rollWithProfile`, pra esse tipo — ver exemplo do roll under abaixo.

`default` é só um hint de UI (formulário já vem preenchido, ex. um
modificador começando em `"0"`) — não muda `required`/validação nenhuma.

Um `input` com `required: false` pode chegar sem valor na rolagem — todo
`outcome_rule` cuja `condition` referencie `{input.id}` dele é **pulada**
nesse caso (não conta como erro), em vez de travar por input ausente. É o
que faz o roll under genérico "só rolar, sem outcome" quando o jogador não
informa o valor testado.

## Input derivado (combina dois inputs num valor que só o motor usa)

`field.dice`/`field.modifier` fazem só substituição LITERAL de `{input.id}`
— sem aritmética. Se a quantidade de dados depende de combinar dois inputs
visíveis (ex.: Fractal — `dice_total` = `fatos_aplicaveis` capado em 3, +1
se `vantagem` e havia pelo menos 1 Fato), esse cálculo não cabe no YAML.

Solução usada (`profiles/fractal.yaml` + `apps/web/src/profileInputQuirks.ts`):
o profile declara só os inputs que o jogador vê (`fatos_aplicaveis`,
`vantagem`) e referencia `{input.dice_total}` no field mesmo esse id **não**
estando em `inputs:` — `validateProfileInputs` só confere os inputs
declarados, e `interpolate()` aceita qualquer chave presente no objeto de
inputs em tempo de rolagem. Quem preenche essa chave extra é
`applyInputQuirks(profile, inputs)`, chamada num ÚNICO lugar
(`profileInputQuirks.ts`) e usada tanto por `roll.ts` (web) quanto por
`headless.ts` (bridge do Android) — duplicar a fórmula nos dois seria o
mesmo erro de sempre (um fica pra trás).

Isso NÃO é um recurso genérico do schema — é solução pontual por sistema.
Se aparecer um terceiro caso, considerar formalizar "input derivado" no
schema em vez de acumular `if (profile.system === "x")` em
`profileInputQuirks.ts`.

## Exemplo — Genérico Roll Under (`overlay`: sem dado próprio)

```yaml
system: roll_under
label: "Genérico — Roll Under"
roll_type: overlay
inputs:
  - id: target
    label: "Valor testado"
    type: number
    required: false
fields: []
outcome_rules:
  - condition: "roll.total <= {input.target}"
    result: success
  - condition: "roll.total > {input.target}"
    result: fail
```

Sem field próprio, o dado vem de fora: o jogador monta o pool no composer
normal (1d20, 3d6, o que quiser) e `rollOverlay(profile, notation, inputs)`
avalia as `outcome_rules` sobre o resultado — `roll` é o nome que a
notação livre de um grupo só sempre recebe (docs/roll-notation.md), por
isso a condition já bate sem configuração extra. Sem `target`, as duas
`outcome_rules` são puladas (ambas referenciam o input ausente) e a
rolagem sai sem `outcome` nem `outcome_flags` — só o dado.

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

## Exemplo — Pool de d6 (contagem de sucessos exposta via `success_rule`)

```yaml
system: pool_d6
label: "Pool de d6 (Shadowrun)"
roll_type: simple
inputs:
  - id: pool_size
    label: "Tamanho do pool"
    type: number
  - id: threshold
    label: "Limite (acertos necessários)"
    type: number
    required: false
fields:
  - id: pool
    dice: "{input.pool_size}d6"
    compare_individually: true
    success_rule: ">=5"
outcome_rules:
  - condition: "pool.total >= {input.threshold}"
    result: success
  - condition: "pool.total < {input.threshold}"
    result: fail
```

### `zero_dice_fallback` só quando zero dado significa OUTRA rolagem

Pool que pode chegar a zero **não** precisa de `zero_dice_fallback`: `0d6`
é notação válida (docs/roll-notation.md) e sai sem dado nenhum, inclusive
no palco 3D. O `fallback` é pra regra que troca a rolagem quando o pool
zera — FitD rola `2d6kl1` (dois dados, fica com o pior), Fractal rola
`1d6`. Usá-lo como "jeito de representar pool vazio" faz o palco animar um
dado que não está na mesa, porque dado descartado anima de propósito.

### `success_rule` + `modifier`: sucessos que vieram de antes

Quando o field tem `success_rule` **e** `modifier`, o modificador soma na
CONTAGEM, não nos valores dos dados: `[6, 3, 4] + 2 = 3` são um seis novo
mais dois sucessos que já estavam na mesa, não `6+3+4+2`.

É o que sustenta o *push* do Year Zero (`yze*.yaml`) sem estado no motor —
a rolagem empurrada rerrola menos dados e carrega os sucessos travados
como modificador (`modifier: "{input.sucessos_anteriores}"`). Um input
usado assim precisa ser `required` com `default: "0"`: field interpola
antes de qualquer outcome_rule, e input opcional em branco no `dice`/
`modifier` é erro (`input ausente`), não regra pulada.

`success_rule` usa a mesma minilinguagem do 2º argumento de `count()`, mas
**sem** as aspas internas (aqui é a string toda, não um literal embutido
numa expressão maior: `">=5"`, não `"'>=5'"`). Quando setado, `total` do
grupo vira a CONTAGEM de dados que batem a regra (sucessos), não a soma —
`"[2, 5, 6, 1] = 2"` aparece pro jogador sem ele contar os dados na mão, e
qualquer `outcome_rule` pode comparar `pool.total` direto em vez de
repetir `count(pool, '>=5')` toda hora.

## Exemplo — World of Darkness v5 (`multi`: dois pools com `success_rule`)

```yaml
system: wod5
label: "Vampiro / WoD v5"
roll_type: multi
inputs:
  - id: regular
    label: "Dados regulares"
    type: number
  - id: hunger
    label: "Dados de Fome/Ira"
    type: number
  - id: difficulty
    label: "Dificuldade"
    type: number
    required: false
fields:
  - id: regular
    dice: "{input.regular}d10"
    compare_individually: true
    success_rule: ">=6"
    slot: 1
  - id: hunger
    dice: "{input.hunger}d10"
    compare_individually: true
    success_rule: ">=6"
    slot: 2
outcome_rules:
  # Crítico sujo: par de 10 com pelo menos um na Fome
  - condition: "(count(regular, '==10') + count(hunger, '==10')) >= 2 and count(hunger, '==10') >= 1"
    result: messy_critical
  # Crítico limpo: par de 10 sem nenhum na Fome
  - condition: "(count(regular, '==10') + count(hunger, '==10')) >= 2 and count(hunger, '==10') == 0"
    result: critical
  # Fracasso bestial: zero sucessos + dado 1 na Fome
  - condition: "(count(regular, '>=6') + count(hunger, '>=6')) == 0 and count(hunger, '==1') >= 1"
    result: bestial_failure
  # Sucesso vs dificuldade (com bônus de pares de 10)
  - condition: "(...) >= {input.difficulty}"
    result: success
  - condition: "(...) < {input.difficulty}"
    result: fail
```

Pontos que distinguem este profile:

- **`success_rule: ">=6"` em ambos os campos**: o `total` de cada grupo é
  a CONTAGEM de dados que passaram, não a soma. A UI mostra
  `regulares [10, 8, 3] = 2 • fome/ira [10, 1] = 1`.
- **Par de 10s como bônus**: o total de sucessos pra comparação com a
  dificuldade inclui `+2` por cada par de 10 (somando regulares e fome).
  Isso é calculado na condition via aritmética booleana
  (`(bool >= 2) * 2`).
- **UI calcula o total localmente** (`wod5Successes` em `format.ts` e
  `ResultFormat.kt`): o motor não tem um campo "total geral com bônus
  de crítico" — isso é apresentação, como o tom de outcome.
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
