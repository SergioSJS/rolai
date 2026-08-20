# Plano de testes do app Android

> **Executado em 2026-08-20.** P1–P6 e E1 estão feitos: 122 -> 192 testes
> JVM, cobertura 20% -> 23,4%, instrumentado 14 -> 15. O que cada um virou
> está marcado abaixo. E2 (Playwright) segue como decisão em aberto.

Estado ao escrever o plano: **20% de cobertura JVM** (798/4.051 linhas),
medido com `./gradlew coverage`.

O número sozinho engana. O que ele diz de verdade:

| classe | linhas | coberto | por quê |
| --- | --- | --- | --- |
| `OutcomeCatalog`, `ProfileForm` | 190 | 100% | dado puro / lógica pura |
| `RichTextPlan` | 88 | 95% | extraído em 1.3.0 |
| `ResultFormat`, `RolaiSettings` | 301 | 86% | lógica pura |
| **`OverlayView`** | **1125** | **0%** | UI construída em código |
| **`SettingsActivity`** | **621** | **0%** | tela inteira |
| **`OverlayService`** | **485** | **0%** | ciclo de vida + orquestração |

Activity, View e Service **não rodam em JVM**. Nenhum teste unitário vai
mover esse 0% enquanto a lógica morar dentro deles. Por isso este plano não
é "escrever teste": é **tirar decisão de dentro de tela** e então testar —
o mesmo movimento que levou `RichTextPlan` de 0% a 95%.

## Como priorizei

Por **risco realizado**, não por tamanho: o que já quebrou, quantas vezes, e
se o app dá algum sinal quando quebra. As três armadilhas do `AGENTS.md`
("existe ≠ funciona", promise pendente, flag estática) são o filtro.

---

## P1 ✅ — `lastRollAction`: a máquina de estado que já voltou quatro vezes

> **Feito** (`LastRoll.kt`, 16 testes). Virou `sealed interface Action` mais
> três funções puras: `persisted`, `quickKey` e `invalidadaPorEdicao`. No
> Service sobraram `setLastRoll()` (campo + persistência num lugar só) e
> `repetir()`.

**Onde:** `OverlayService.kt` — 10 atribuições, 4 invalidações explícitas.
**Cobertura hoje:** 0%.
**Histórico:** é o bug citado 5 vezes em `docs/adding-a-system.md` e de novo
no `AGENTS.md` — *"repetir rolagem com valor velho no overlay do Android
voltou disfarçado de bug novo umas quatro vezes"*.

É um campo `(() -> Unit)?` que decide o que a mini-bolha do fan repete:
rolagem por notação, por profile, overlay (roll_under), push do Year Zero ou
puxada de carta. Cada caminho o reescreve; fechar o painel, trocar campos ou
trocar de sistema o invalida. **Nada disso é observável de fora**, e é
exatamente por isso que o mesmo bug volta com cara nova.

**Trabalho:** extrair para uma classe própria — `LastRollAction` ou
`RepeatableRoll` — que guarda uma *descrição* do que repetir (data class:
tipo + sistema + notação + inputs) em vez de uma closure. O Service passa a
traduzir descrição → chamada no `headlessRoller`.

Ganha duas coisas: dá pra **comparar** (é a comparação que decide invalidar)
e dá pra **testar**.

**Casos:**
- rolar por notação → repetir chama a mesma notação
- rolar por profile com inputs → repetir manda os mesmos inputs
- puxar carta → repetir puxa carta, não a rolagem anterior
- Forçar (push) → repetir NÃO repete o push com pool velho
- mudar um campo do formulário → invalida
- fechar o painel sem mudar campo → **não** invalida (foi o bug de 2026-08-19)
- `push_*` (escrituração do Forçar) mudando → não conta como mudança de campo

**Tamanho:** ~120 linhas movidas, ~12 testes. **Impacto:** ~3% de cobertura
e o fim da reincidência mais cara do projeto.

## P2 ✅ — Compositor de notação: string pura, bug confirmado, zero teste

> **Feito** (`NotationComposer.kt`, 19 testes, 100% de cobertura). `countsByKey`
> saiu junto — o que o chip mostra é contagem pura.

**Onde:** `OverlayView.kt`, 5 funções, ~110 linhas:
`addDieToNotation`, `addDieToSimpleExpression`, `removeDieFromNotation`,
`removeDieFromSimpleExpression`, `syncChipsWithNotation`.
**Cobertura hoje:** 0%.
**Histórico:** *"compositor apagava notação de slot ao clicar botão de dado
(1[d20])"* — corrigido na 1.2.0, sem teste que impeça a volta.

São `String -> String`: entra notação e um dado, sai notação. Não tocam em
View nenhuma — estão ali só porque nasceram ali. Movimento idêntico ao do
`RichTextPlan`.

**Casos:** somar dado a notação vazia; somar a `2d6`; somar a `1[d20]`
(slot); somar carta; remover o último de um tipo; remover de multi-slot;
notação inválida não vira lixo; `syncChips` refletindo o que foi digitado à
mão.

**Tamanho:** ~110 linhas movidas, ~15 testes. **Impacto:** ~3%.

## P3 ✅ — `RoomClient.onMessage`: o parser do protocolo

> **Feito** (`ServerEvent.kt`, 16 testes, 97-100% por tipo).

**Onde:** `RoomClient.kt`, 62 linhas. **Cobertura hoje:** 0%
(`RoomClientUrlTest` cobre a URL do handshake, não a leitura).

Traduz cada evento do servidor (`snapshot`, `roster`, `roll`, `deck_draw`,
`deck_shuffle`, `deck_config`, `error`) em chamada de `Listener`. Um campo
que muda de formato no backend passa despercebido aqui — foi assim que o
`smoke_ws.py` ficou quebrado por meses quando o roster virou objeto.

**Trabalho:** o `when` já é quase puro. Extrair para
`ServerEvent.parse(json): ServerEvent?` (sealed class) e o `onMessage` vira
despacho.

**Casos:** cada tipo de evento; JSON inválido não derruba a conexão; campo
opcional ausente vs `null`; tipo desconhecido é ignorado em silêncio;
`deck_config` com só um campo presente.

**Tamanho:** ~60 linhas movidas, ~12 testes. **Impacto:** ~1,5%, e um
alarme para mudança de contrato.

## P4 ✅ — Dosagem do som

> **Feito** em parte: `DiceSounds.cardDelays()` e `ResultFormat.cardCountOf`
> ganharam teste. O `playDiceSound` em si continua sendo um `postDelayed` —
> a decisão que sobra ("nenhuma colisão chegou") é uma linha, e extrair um
> arquivo pra ela custaria mais do que paga.

**Onde:** `OverlayService.playDiceSound` (25 linhas) e
`DiceStageWindow.onDiceImpact` (33). **Cobertura hoje:** 0%.
`DiceSounds.volumeFor`/`impactDelays` **já** têm teste — o que falta é quem
os chama.

Baixa prioridade de risco, mas: som quebra em silêncio. Nesta sessão o som
esteve morto em três lugares e nenhuma suíte piscou.

**Casos:** cai no fallback quando não chega colisão em `SOUND_FALLBACK_MS`;
não toca duas vezes pela mesma rolagem; carta dosa pelo número de cartas.

**Tamanho:** ~60 linhas, ~8 testes.

## P5 ✅ — `SettingsActivity`: 621 linhas a 0%

> **Feito** em parte: `RoomStatusChip.kt` (9 testes) tirou a tabela de decisão
> do chip de sala. `saveFromViews`/`loadIntoViews` ficaram: são leitura e
> escrita de campo, muita linha e pouco risco por linha — não valem a
> indireção agora.

**Onde:** `saveFromViews` (61 linhas), `renderRoomStatus` (38), `applyPreset`
(24), `saveCurrentSlotFromControls` (21) e a leitura de `systems.json`.

`resolveSystemIndex` já saiu (1.3.0, `SystemSpinner`, 8 testes) — foi a parte
com bug histórico. O que resta é leitura e escrita de formulário: muita
linha, pouco risco por linha.

**Trabalho:** extrair o mapeamento **estado ↔ preferências** (o que
`saveFromViews` e `loadIntoViews` fazem sem as Views) e o texto de
`renderRoomStatus` (`RoomState` + código + contagem → string).

**Tamanho:** ~120 linhas movidas, ~15 testes. **Impacto:** ~3%.

## P6 ✅ — Restinho puro

> **Feito**: `systemShortLabel` foi pro `ProfileFamilies` (4 testes). O resto
> (`quickKeyOf`, `buildDeckConfigJson`) foi absorvido pelo P1 ou continua
> trivial demais pra valer arquivo próprio.

`systemShortLabel` (35), `quickKeyOf` (7), `buildDeckConfigJson` (8),
`loadDeckConfig` (13). Somam ~60 linhas e são baratos de pegar de carona
quando se mexer nos arquivos acima. **Não faça uma tarefa só disso.**

---

## O que fica em 0% de propósito

`OverlayView` continuará com ~900 linhas de construção de UI a 0%, e está
certo: são `LinearLayout`, `GradientDrawable` e `setOnClickListener`. Testar
isso pede Robolectric ou instrumentado, e o retorno não paga — quem cobre é
o instrumentado e `docs/manual-test-checklist.md`.

**A meta não é 80% de cobertura. É 0% de decisão dentro de tela.**

Somando P1–P6, o previsto era ~470 linhas movidas, ~62 testes e 32-35% de
cobertura. O realizado: **70 testes novos** (122 -> 192) e **23,4%**.

A diferença no percentual merece explicação, porque ela ensina algo: o que
saiu das telas foi menos linha do que a estimativa (o despacho continua no
Service, e deve continuar — é ele que conhece o motor), enquanto o que
entrou de teste foi mais. Cobertura mede linha executada, não risco coberto;
os arquivos novos estão todos em 97-100%, e são justamente os que guardavam
os bugs reincidentes. **O número subiu pouco e o risco caiu muito** — que é
o resultado que se queria, ainda que não seja o que a métrica mostra.

---

## Depois do unitário: e2e

Só faz sentido **depois** de P1–P3. Testar por fora o que dá pra testar por
dentro é caro e lento — e os três bugs mais caros desta sessão (som mudo,
cleartext, seletor de cor) não teriam sido pegos por nenhum e2e de
navegador.

### E1 ✅ — Instrumentado: o que já existe, ampliado

> **Feito**: `StageRendersTest` monta o palco e pergunta se `window.rolaiStream`
> existe — a ponte que o StreamApp publica quando o bundle roda. Conferido por
> mutação: apontando pra um endereço inexistente, falha. Fecha a lacuna que
> virou "tela branca" nesta sessão.
>
> Continuam pendentes: fluxo de sala do Service com MockWebServer, e o
> `lastRollAction` de ponta a ponta (agora possível, já que virou dado).

Hoje são 14 testes (`run-instrumented.sh`, aparelho, fora do CI):
`HeadlessRollerParityTest` (3), `KeepDropHeadlessTest` (2),
`OfflineStageTest` (4), `OverlayServiceTest` (3), `RoomClientReconnectTest` (2).

É o e2e mais valioso do projeto porque cobre o que só existe no aparelho.
Faltam:
- **palco de fato desenhando** — hoje `OfflineStageTest` prova que os assets
  estão no APK, não que a cena sobe. Um `evaluateJavascript` perguntando se
  `window.rolaiStream` existe fecharia a falha que virou "tela branca".
- **fluxo de sala do Service**: entrar, receber rolagem de outro, empurrar
  pro palco — com `MockWebServer` no lugar do backend.
- **`lastRollAction` de ponta a ponta**, depois de P1.

Custo: baixo, a infraestrutura existe. Continua **fora do CI** (emulador é
lento e instável, decisão registrada no `AGENTS.md`).

### E2 ✅ — Playwright: um teste, não uma suíte

> **Feito** (`apps/web/e2e/sala.spec.ts`, 2 testes, ~8s). Local, fora do CI.
> Conferido por mutação, e a conferência ensinou duas coisas:
>
> 1. Com 20 arrastos o teste passava **mesmo com o bug de volta** — 22
>    conexões não estouram o limite de 30/min. Subiu pra 40, que é a ordem de
>    grandeza do relato original (28 num arrasto só).
> 2. Ainda assim passava: atribuir `el.value` direto **não dispara o onChange
>    do React**, que intercepta o setter da propriedade. O teste mexia no DOM
>    e o app não ficava sabendo. Com o setter nativo, o bug produz 30
>    conexões e 2 `rate_limited`, e o teste falha no sintoma real (expulso da
>    sala). Com a correção: 5 conexões nos dois testes.
>
> Um e2e que passa dos dois lados da mutação é pior que nenhum: dá confiança
> sem dar cobertura.

Dois contextos de navegador contra o backend local: um rola, o outro recebe;
um troca a cor, o outro vê. Cobre a seção 1 do checklist manual — a parte
mais cara de conferir à mão.

**Não cobre** som, WebGL de verdade, nem nada do Android. Ou seja: não
substitui o checklist, encurta ele.

Custo real: subir backend + web no CI, lidar com flakiness de timing de WS,
manter um segundo runner. Por isso: **um teste**, não uma suíte, e só quando
a seção 1 do checklist começar a doer.

### E3 — O que não vale automatizar

Som e leitura visual do overlay. Continuam no checklist manual, e continuam
sendo onde o teste humano ganha do automatizado.

---

## Ordem sugerida

1. **P1** (`lastRollAction`) — maior risco realizado do projeto
2. **P2** (compositor) — bug confirmado, extração trivial
3. **P3** (`onMessage`) — alarme de contrato com o backend
4. **E1** (ampliar instrumentado) — já com P1 testável de fora
5. **P4**, **P5**, **P6** — conforme tocar nos arquivos
6. **E2** (Playwright) — só se a seção 1 do checklist virar gargalo

P1 e P2 sozinhos cobrem os dois bugs reincidentes documentados do app.
