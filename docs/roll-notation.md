# Notação de rolagem (camada 1 — genérica)

Esta camada só sabe **agrupar e resolver dados**. Ela não sabe o que os
grupos significam pra nenhum sistema — isso é responsabilidade do profile
(`docs/system-profiles.md`).

## Base

Notação padrão Roll20 (via `dice-roller-parser` ou equivalente):

```
2d6          -- pool simples
2d6+3        -- com modificador
4d6dl1       -- keep highest 3 (drop lowest 1)
4d6kh3       -- keep highest 3 (forma alternativa)
4d6!r<2      -- reroll condicional (reroll se <2)
1d20adv      -- vantagem (extensão comum, não-padrão Roll20 — expor como
                açúcar sintático que expande pra 2d20kh1)
4dF          -- dado Fudge/Fate: três faces valendo -1, 0 e +1
```

### Dado Fudge (`dF`)

`NdF` (maiúsculo ou minúsculo) é um dado de três faces cujos **valores** são
`-1`, `0` e `+1` — não `1..3`. No AST ele aparece como `sides: 3` mais a flag
`fudge: true`; o roller é quem mapeia pro intervalo. Consequências:

- os valores em `rolls` (e na fila `deterministic`) são `-1 | 0 | 1`;
- `total` soma normalmente, então `4dF+2` pode dar de `-2` a `+6`;
- keep/drop funciona (`4dFkh2`); `!r` **não** se aplica (o alvo numérico do
  reroll não tem significado nessas faces) e é erro de parse.

### Cartas de Baralho (`c`)

`Nc` (ex: `2c`, `1c`) representa o saque de $N$ cartas de desafio do baralho
(usado por Firelights e composições mistas com cartas):

- no AST ele aparece como `sides: 13` mais a flag `card: true` (1 = Ás, 2..10, 11 = Valete, 12 = Dama, 13 = Rei);
- em comparações individuais (como `{2d6+2} vs {2c}` do Firelights), cada
  carta retém seu valor individual para comparação com a rolagem de ação.

## Extensão: grupos comparados

Operador de agrupamento — produz **arrays separados de resultado**, não
soma tudo junto. A comparação em si (soma-contra-soma, elemento-a-elemento,
etc) é decidida pelo profile, nunca pela gramática.

```
{1d6+2} vs {2d10}
```

Resultado cru desse parse:

```json
{
  "groups": {
    "action": { "notation": "1d6+2", "rolls": [4], "modifier": 2, "total": 6 },
    "challenge": { "notation": "2d10", "rolls": [7, 3], "total": null }
  }
}
```

Note que `challenge` não tem `total` — grupos multi-dado sem operador de
soma explícito mantêm os valores individuais disponíveis pra comparação
elemento a elemento no profile.

## Extensão: pool misto (multi-termo)

Um grupo pode somar/subtrair vários termos de dado e números:

```
2d6+1d4+3      -- dois termos de dado + modificador numérico
1d20-1d4       -- termo subtraído desconta do total
4d6kh3+1d20    -- keep/drop fica preso ao termo a que está anexado
```

Regras:

- Termos numéricos agregam algebricamente no `modifier` do grupo.
- Termos de dado concatenam os rolls **na ordem dos termos** (rolls
  mantidos, depois do keep/drop de cada termo — keep/drop/reroll nunca
  misturam dados de termos diferentes).
- Grupo multi-termo **sempre** tem `total` = soma algébrica dos termos
  mais o modificador. Grupo de termo único segue as regras de sempre
  (`2d6` sem operador continua sem `total`).
- O AST guarda os termos com sinal em `GroupSpec.terms` (o campo `dice`
  continua sendo o primeiro termo + modificador, pra compatibilidade).
- O contrato `RollResult`/`RollGroup` não muda.

### Dados descartados (`dropped`)

Keep/drop não some com o dado: `RollGroup.dropped` guarda o que caiu fora,
na ordem em que caiu. `rolls` continua sendo só o que CONTA no total.

O motivo é de leitura: `4d6kh3` mostrando 3 dados esconde metade do que
aconteceu, e `10d6kh1` mostrava 1 de 10 — não parecia a rolagem pedida. A
UI exibe o pool inteiro (descartado apagado e riscado) e o palco 3D rola
todos.

Campo **ausente** quando não houve descarte — o payload de quem não usa
keep/drop fica idêntico ao de antes.

## Saída canônica (contrato entre rules-engine e o resto do sistema)

Todo resultado de rolagem, com ou sem profile, produz este formato — é o
que trafega pelo WS e o que vai pro histórico:

```ts
interface RollResult {
  notation: string;          // string original digitada/montada
  groups: Record<string, {
    rolls: number[];
    modifier?: number;
    total?: number;
  }>;
  profile?: string;          // id do profile aplicado, se houver
  outcome?: string;          // resultado interpretado pelo profile (ex: "strong_hit")
  timestamp: string;         // ISO 8601, atribuído no momento do cálculo local
}
```

## O que NÃO entra nesta camada

- Nomes de resultado (miss/hit/strong hit) — isso é `outcome`, vem do
  profile.
- Regras de "quem ganha o confronto" — profile.
- Qualquer coisa específica de um sistema de RPG.

Ver `packages/rules-engine/test/` para os casos de teste que qualquer
implementação do parser precisa cobrir antes de ser considerada completa.
