# Changelog

Todas as mudanças notáveis neste projeto estão documentadas aqui.
Formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/)
e o projeto adere a [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.3.0] — 2026-08-20

### Mudado
- **Fatiamento dos arquivos grandes** (sem mudança de comportamento):
  - Android: a leitura do resultado saiu da view e do service para
    `ResultFormat.kt` (JSON -> texto), `RichTextPlan.kt` (o que pintar,
    como dado puro) e `ResultSpans.kt` (aplica os spans). `OverlayPalette.kt`
    e `DieIconDrawable.kt` também saíram da `OverlayView`.
  - Backend: `rooms.py` (790 linhas) virou `room_store.py`, `room_deps.py`,
    `room_export.py` e `room_ws.py`, com o handshake do WebSocket extraído
    em `_admit()`.
  - Web: `styles.css` (2856 linhas) virou 13 arquivos em `src/styles/` —
    o CSS compilado saiu byte a byte idêntico; a sala do `App.tsx` virou o
    hook `useRoomSession`.
- **Catálogo de apresentação do Android agora é gerado**: rótulos de
  outcome, tons e famílias de sistema saem de `apps/web/src` para
  `OutcomeCatalog.kt` no `build:headless`. Eram tabelas copiadas à mão em
  Kotlin, cujo esquecimento não dava erro nenhum — só id cru na tela do
  overlay. O CI falha se o gerado divergir do commitado.
- **Profiles varridos do diretório**: `apps/web/src/profiles.ts` usa
  `import.meta.glob` em vez de 21 imports escritos à mão.
- `resolveSystemIndex` saiu da `SettingsActivity` para `SystemSpinner.kt`,
  como função pura — guardava a correção de um bug que já apareceu duas
  vezes e não tinha teste possível onde estava.

### Adicionado
- **Som de carta no Android**, nos dois sentidos: carta puxada no aparelho e
  carta que chega da sala. Não havia caminho nenhum — o Service não tocava
  nada em carta, `DiceSounds` só conhecia dado, e o palco roda com `sound=0`
  de propósito (áudio de WebView pede foco e abaixa a música da mesa).
- **Som de carta no modo stream/OBS**: `playCardDraw` só existia no App
  principal; o `StreamApp` animava em silêncio.

### Corrigido
- **Arrastar o seletor de cor derrubava quem mexeu para fora da sala**:
  `<input type="color">` dispara a cada movimento, cada mudança reabria o
  WebSocket (a aparência viaja no handshake), e 28 conexões em segundos
  estouravam o `ws_connect_limit_per_minute`. O 4429 resultante é tratado
  como recusa definitiva, então o cliente limpava o código da sala.
  Agora há debounce de 300 ms e a reconexão é ignorada quando a aparência
  não mudou de fato.
- **Palco de stream subia mudo e nunca mais tentava**: aba em segundo plano
  não carrega mídia (o caso de toda Browser Source do OBS), então o
  `canplaythrough` que a lib espera nunca chegava e a corrida de 2,5 s
  sempre perdia. O teto foi para 9 s, aba oculta não tenta (sobe mudo na
  hora em vez de travar) e o áudio entra sozinho quando a aba aparece.
- Trocar a cor dos dados dentro de uma sala reconectava mandando só o
  estilo do slot 1 no handshake — a mesa continuava vendo os dados 2 e 3 na
  cor antiga até o próximo join.
- **Android: servidor na rede local era impossível.** O
  `network_security_config` só liberava cleartext em loopback, então o campo
  "Servidor (avançado)" só funcionava via `adb reverse`. Build de debug
  passa a permitir; o release continua exigindo TLS.
- **Android: queda de sala sem motivo.** `RoomClient.onFailure` engolia o
  Throwable — só se via "conectando… / reconectando…" em loop. Agora loga
  tipo, mensagem e código HTTP.
- Backend deixa de estourar `Exception in ASGI application` quando o cliente
  fecha no meio do handshake e o snapshot sai para um socket morto.
- Toast de código curto era lido como recusa, mas a entrada nunca foi
  bloqueada — texto reescrito para dizer o que de fato acontece.
- Ferramentas de validação que estavam quebradas há tempos e ninguém sabia:
  a suíte instrumentada não compilava desde a 1.1.1, `OfflineStageTest`
  pedia `index.html/index.html` e o smoke de sala fim-a-fim comparava o
  roster com um formato que mudou quando o dado ganhou cor.

### Desempenho
- **three.js fora do chunk de entrada**: o palco 3D de cartas passou a ser
  import dinâmico. Entrada de 1,39 MB -> 915 KB (419 KB -> 293 KB gzip).

### Testes
- 18 casos de JVM cobrindo a formatação rica do overlay (`RichTextPlanTest`),
  que antes só dava para conferir olhando o celular.
- 17 casos cobrindo a sala como o App a usa (`useRoomSession`), incluindo os
  dois de regressão conferidos por mutação.
- 8 casos para `SystemSpinner`, a resolução de modo salvo que já quebrou
  duas vezes.

## [1.2.0] — 2026-08-20

### Adicionado
- **Vampiro / WOD5 — contagem de sucessos e destaque visual**:
  - `success_rule: ">=6"` nos campos `regular` e `hunger` de `wod5.yaml` —
    agora cada pool reporta quantos dados passaram (ex.: `regulares [10, 8, 3] = 2`).
  - Cálculo automático de par de 10s: cada par soma +2 sucessos de bônus,
    refletido tanto na avaliação contra dificuldade quanto no total exibido.
  - Headline mostra total de sucessos: `4 sucessos — crítico manchado
    (Dificuldade: 2)` ou simplesmente `2 sucessos` sem dificuldade.
  - **Chips com status visual** na web: dados ≥6 com borda verde luminosa,
    10 com borda dourada e glow, falhas (< 6) com opacidade reduzida, e
    1 na Fome com borda vermelha (bestial). Mesma lógica para Year Zero e
    Pool d6.
  - No overlay Android, números dentro de `[colchetes]` ficam coloridos
    (verde ≥6, dourado para 10) tanto no resultado principal quanto no
    histórico.
- **Layout hierárquico do resultado no overlay Android**:
  - Resultado dividido em **headline** (grande, colorida pelo tom do outcome)
    e **linha de detalhe** (menor, com pools nomeados e separados por `•`).
  - Parâmetros testados (Dificuldade, Limiar, etc.) em fonte menor e muted.
  - `formatDisplayLines` e `formatRichResult` com `SpannableStringBuilder`
    para cores de slot, negritos e tamanhos distintos.

### Corrigido
- **Dados 3D perdiam cores de slot na segunda rolagem**: ao trocar de modo
  (ex.: Vampiro → rolagem livre → Vampiro de novo) os dados saíam todos
  da mesma cor. A causa era o `diceBox.updateConfig` não reaplicando as
  customizações de slot corretamente.
- **Compositor limpa texto ao clicar botão de dado**: digitar `1[` e clicar
  em "d20" apagava o que já estava escrito. A lógica de inserção agora
  preserva e completa a notação de slot.
- **Resultado de multi-grupo sem total**: notações como `1[1d6] + 2[2d6]`
  não mostravam o grand total nem os totais individuais.
- **Headline cortada em resultados longos**: texto de outcome com mais de
  ~6 caracteres recebia overflow escondido.

## [1.1.1] — 2026-08-19

### Adicionado
- **Customização de 3 slots de dados** (web e Android): corpo, número e
  contorno independentes por slot (Primário, Secundário, Terciário).
- **Perfis Trophy** (Trophy Dark / Trophy Gold): claros vs escuros, ruína.
- **Família Year Zero Engine completa**: `yze` (genérico), `yze_fbl`
  (Forbidden Lands, 3 pools), `yze_alien` (Alien, base + estresse),
  `yze_wdu` (Vaesen/WDU, base + estresse). Empurrar rolagem (push) com
  `sucessos_anteriores` como modificador de contagem.
- **Logs ricos no overlay Android**: histórico com cores de slot, destaque
  de outcomes (verde/amarelo/vermelho), nomes de jogadores em negrito.
- **Abas de sistema no overlay**: seleção de modo de rolagem (Infaernum,
  Ironsworn, etc.) movida para a tela de Preferências do Android, em vez
  de abas dentro da caixa de rolagem.

### Corrigido
- Abas do Infaernum restauradas após refatoração.
- Tabs uniformes no overlay.
- Escala de prévia de dados corrigida.
- Tipos TypeScript no build de produção.
- Botão de limpar no overlay reposicionado para não competir com inputs.

## [1.1.0] — 2026-08-18

### Adicionado
- **Limite de concorrência** do uvicorn aumentado para 2048.

## [1.0.1] — 2026-08-17

### Corrigido
- Padrão de regex no overlay e fade de cartas no StreamApp.
- Histórico do overlay ordenado do mais recente pro mais antigo.
- Formatação de multi-grupo e cartas no overlay Android.
- `deck-engine` incluído no Dockerfile do web e no CI.
- Imports e variáveis não usadas removidas (build TS).

## [1.0.0] — 2026-08-16

### Adicionado
- **Cartas na notação do motor** (`Nc`, ex.: `2c`): valores 1–13 mapeados
  para Ás, 2–10, J, Q, K com naipes cíclicos (♠♥♣♦).
- **Sistema Firelights**: ação `{2d6+mod}` contra desafio de 2 cartas `{2c}`.
- **Renderização 3D separada**: dados físicos (dice-box) + cartas 3D
  (Three.js) coexistindo no mesmo palco.
- **Baralho completo** (`packages/deck-engine`): 52/54 cartas,
  embaralhamento determinístico, descarte e reembaralhamento.
- Botões de d2, d3, d66 e carta no compositor (web e overlay).
- Overlay Android reorganizado em 3 abas (Sistema / Dados / Baralho).
- Submenu colapsável de Qualidade e Desempenho no Android.
- Sons de carta (CC0, Kenney.nl).
- Documentação, README e arquitetura atualizados.
