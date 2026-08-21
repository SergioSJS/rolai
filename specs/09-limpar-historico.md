# 09 — limpar histórico (ocultar local + limpar da sala)

## Objetivo

Dar duas saídas honestas pro pedido "limpa esse log", que hoje não tem
nenhuma:

- **Ocultar daqui pra trás** — filtro local, só pra quem clicou,
  desfazível. Ninguém mais na sala percebe.
- **Limpar a sala** — apaga o histórico no Redis pra todo mundo,
  irreversível, com confirmação.

Os dois nomes são parte do escopo: "limpar" que só esconde pra você é a
armadilha que este spec existe pra evitar. Quem rolou besteira e quer que
suma da mesa precisa do segundo botão — o primeiro não faria nada pelo
próximo que entrar na sala nem pelo link de export.

Junto vem `received_at` carimbado pelo servidor, que é o que torna o corte
estável, e de quebra dá hora local correta em cada entrada.

## Estado atual (2026-08-20)

**Implementado** — backend, web e testes automatizados dos dois lados. Falta
só a passada manual (`docs/manual-test-checklist.md`, seção 1). O que segue
descreve o desenho; o "não existe" abaixo é o ponto de partida.

Nada disso existia. Histórico é `room:{code}:history` (lista Redis, ordem de
chegada, capada em `settings.history_max_entries`), renderizado por
`HistoryList.tsx` a partir de `room.history` (em sala) ou `localHistory`
(fora de sala, só `useState` em `useRoomSession.ts:98`).

Toda entrada carrega um `timestamp` **do cliente**: `new Date().toISOString()`
no web (`App.tsx:287`) e `Instant.now().toString()` no Android
(`OverlayService.kt:719`). Ambos UTC.

## Decisão: o corte é por `received_at` do servidor, não por índice nem pelo timestamp do cliente

Três candidatos a chave de corte, e por que dois não servem:

- **Índice na lista** — o `snapshot` do reconnect substitui o array inteiro
  (`reducer.ts`, case `"snapshot"`) e o `LTRIM` come as mais velhas. Índice
  12 antes ≠ índice 12 depois.
- **`timestamp` do cliente** — é o relógio do aparelho de quem rolou.
  Aparelho com hora torta esconde entrada que não foi ocultada, ou deixa
  visível uma que foi. Fuso **não** é o problema aqui (todo mundo já manda
  UTC); relógio errado e latência são.
- **`received_at` do servidor** — carimbado na hora do `append_history`,
  ordem idêntica à ordem real da lista, imune a trim e a reconnect.

## Escopo

### `services/backend`

**Campo novo, no wrapper do histórico — não dentro de `RollResult`:**

```python
received_at: str | None = None   # datetime.now(UTC).isoformat()
```

Vai nas quatro classes de `HistoryEntry` (`RollHistoryEntry`,
`DeckDrawHistoryEntry`, `DeckShuffleHistoryEntry`, `DeckConfigHistoryEntry`)
em `schemas.py`. Preenchido em `RoomStore.append_history`.

Fica **fora** de `RollResult` de propósito: aquele é o payload do cliente, e
o relay não reescreve payload de cliente. A regra de ouro segue intacta —
carimbar hora de chegada não é recalcular rolagem. Os dois campos coexistem:
`result.timestamp` é quando rolou no aparelho, `received_at` é quando o
relay recebeu. A diferença entre eles mede skew de relógio, útil no dia em
que alguém reclamar de hora errada.

**`| None` é obrigatório, não preguiça.** Sala viva no Redis já tem entradas
serializadas sem o campo. Se for obrigatório,
`_HISTORY_ENTRY_ADAPTER.validate_json` levanta, `RoomStore.history()`
explode, e o `snapshot` quebra a sala inteira até o TTL expirar — deploy
derruba mesa em andamento.

**`received_at` também vai no broadcast**, não só na entrada guardada
(`room_ws.py`, os quatro `event = {...}`). Sem isso o cliente só enxerga o
campo depois de um reconnect, e o corte não pega o que chegou ao vivo.

**Evento WS novo — limpar a sala:**

```
cliente -> servidor  {"type": "history_clear"}
servidor -> todos    {"type": "history_cleared", "player": str, "received_at": str}
```

- `DEL room:{code}:history`. A sala continua viva: marcador e roster
  intactos, TTL renovado como em qualquer evento.
- Espectador é barrado, mesmo caminho de `spectator_cannot_roll`
  (`room_ws.py`) — quem assiste pelo OBS não apaga o log da mesa.
- Sem autorização por membro: não há conta neste projeto, e quem tem o link
  já pode floodar a sala. A defesa é a confirmação na UI e o token bucket
  por conexão, que já conta esta mensagem como qualquer outra.
- Sem undo. Está no nome do botão.

**Export respeita o corte:** `GET /rooms/{code}/export` ganha
`since: str | None = Query(default=None)`, filtrando `received_at > since`.
Comparação de string ISO em UTC, feita em Python depois do `LRANGE` — sem
Redis novo e sem duplicar formatação em TS. Coluna `received_at` entra no
CSV e no Markdown (`room_export.py`).

### `apps/web`

**Estado do corte:** `hiddenBefore: string | null` (ISO), persistido em
`localStorage` por código de sala. Render filtra `received_at > hiddenBefore`.
Undo = voltar pra `null`, exposto como "Mostrar tudo" enquanto houver corte
ativo — o botão precisa ficar visível, senão o corte vira mão única.

Persistir é decisão consciente: sem isso, um F5 desfaz o que o usuário pediu
sem ele pedir.

**Fallback de entrada sem `received_at`** (legado de sala já viva, e modo
sem sala): compara pelo `timestamp` do cliente. É o relógio errado que este
spec evita, mas o alcance é curto — uma janela de deploy dentro de um
`room_ttl_seconds`.

**Fora de sala:** `localHistory` é `useState`. "Limpar" apaga de verdade,
sem servidor pra discordar. `received_at` é carimbado na inserção com
`new Date().toISOString()` — uma ponta só, não existe skew entre pares. O
mesmo botão "Ocultar" continua fazendo sentido e usa o mesmo `hiddenBefore`.

**Hint de hora local:** cada entrada mostra a hora formatada com
`Intl.DateTimeFormat` no fuso do navegador, a partir de `received_at` (com o
fallback acima). É o que fecha "vantagem extra" do carimbo de servidor: hora
de sala consistente pra todo mundo, exibida no fuso de cada um.

**Link de export** (`RoomPanel.tsx:212`) passa `&since=` quando houver corte
ativo. Sem corte, URL igual à de hoje.

**`history_cleared`** entra no `roomReducer` zerando `history`. Não mexe em
`hiddenBefore`: o que vier depois tem `received_at` maior que o corte e
aparece normalmente.

### `apps/android`

Nada a fazer. `RoomClient.kt` usa `org.json`, que ignora campo desconhecido
por construção — `received_at` no broadcast não quebra nada. O overlay não
renderiza histórico de sala, e o `rules-engine` não é tocado, então **não**
precisa de `build:headless` nem `build:stage`.

## Fora de escopo

- Apagar entrada individual (só o corte "daqui pra trás").
- Export fora de sala — não existe hoje e continua não existindo; exigiria
  formatação CSV/MD em TS, duplicando `room_export.py`.
- Sincronizar o "Ocultar" entre abas ou aparelhos do mesmo usuário. É local
  por dispositivo, por definição.
- Qualquer noção de dono/moderador de sala.

## Critérios de aceite

- Ocultar esconde tudo até o clique, mantém o que vier depois, e "Mostrar
  tudo" traz de volta — inclusive depois de F5 e depois de reconectar numa
  sala que já perdeu entradas pro `LTRIM`.
- Ocultar numa aba não muda nada na outra aba na mesma sala.
- Limpar a sala esvazia o histórico nas duas abas, e quem entrar depois
  recebe `snapshot` com histórico vazio.
- Espectador recebe erro ao tentar limpar, e o histórico segue intacto.
- Export com corte ativo não traz nenhuma entrada oculta; sem corte, traz
  tudo. CSV e MD têm coluna `received_at`.
- Sala com entradas antigas (sem `received_at`) continua carregando o
  `snapshot` sem erro depois do deploy.
- Cada entrada mostra hora no fuso local do navegador.

## Testes

- `pytest`: `append_history` carimba `received_at`; broadcast dos quatro
  tipos carrega o campo; JSON legado sem o campo continua validando;
  `?since=` filtra; `history_clear` apaga e faz broadcast; espectador
  barrado.
- `vitest`: reducer trata `history_cleared`; filtro por `hiddenBefore` com e
  sem `received_at`; undo; persistência por código de sala; `exportUrl` com
  e sem corte.
- `docs/manual-test-checklist.md`: item novo de duas abas na mesma sala —
  ocultar numa não afeta a outra, limpar afeta as duas.
