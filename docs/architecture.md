# Arquitetura

## Visão geral

```
apps/web (React/TS, PWA)  ---\
                              >--  services/backend (FastAPI)  --  Redis (estado de sala, TTL)
apps/android (Kotlin, TWA)  --/                                \-  Postgres (profiles duráveis)
```

- **apps/web**: UI completa, render 3D (dice-box), e o `rules-engine`
  embarcado.
- **apps/android**: TWA que carrega o mesmo `apps/web`, mais um Foreground
  Service nativo que desenha o overlay (botão/barrinha), mantém o WebSocket
  vivo em background e aciona uma WebView headless (sem render, só cálculo)
  rodando o mesmo `rules-engine`.
- **services/backend**: relay burro. Não recalcula rolagem — só resolve o
  RNG quando o profile exige resolução confiável, e retransmite pra sala.
- **Redis**: estado efêmero de sala (roster, histórico curto, TTL que reseta
  a cada evento).
- **Postgres**: só o que precisa sobreviver entre sessões — profiles de
  sistema customizados pelo usuário.

## Decisões já tomadas (não revisitar sem motivo novo)

### Transporte: WebSocket relay, não WebRTC/P2P

O payload de uma rolagem é ~100 bytes. O ganho de WebRTC P2P (evitar
retransmissão de mídia pesada) não se aplica aqui — só adicionaria
complexidade de signaling/ICE/TURN sem benefício. Um relay WS centralizado
em FastAPI é mais simples, mais fácil de dar TTL/histórico, e já encaixa
no stack que o backend usa.

### Resultado calculado no cliente, servidor só retransmite

Quem rola calcula localmente (parser + profile + RNG do próprio
`rules-engine`) e propaga o resultado já pronto. O servidor não valida.
Trade-off aceito: em tese dá pra forjar um resultado antes de enviar — não
é relevante pro caso de uso (mesa entre amigos), e evita duplicar o motor
de regras em Python só pra validação server-side. Ver `docs/security.md`
para quando isso deixaria de ser aceitável (ex: salas públicas abertas).

### Renderização 3D com resultado determinístico

`dice-box` / `dice-box-threejs` suportam forçar o valor final mantendo a
física de queda visualmente aleatória. Isso é o que permite: cada cliente
anima a própria queda localmente, sem sincronizar frame-a-frame, e ainda
assim todo mundo vê o mesmo número final.

### Escada de qualidade de render (por cliente, não por sala)

| Nível | Motor | Contexto típico |
|---|---|---|
| 3D completo | dice-box, física + sombra | Gravação OBS, aparelho forte |
| 3D leve | mesmo motor, sombra/luz reduzida | Padrão em mid-range |
| 2D animado | sprite/CSS, sem física/WebGL | Fallback leve, ou por escolha |
| Texto puro | número direto, sem animação | Botão flutuante Android (overlay) |

O overlay do Android **sempre** usa o tier de texto puro — não faz sentido
animar 3D numa bolha flutuante sobre outro app. A pessoa vê o resultado
completo quando abrir o app.

### Chroma key / fundo pro OBS

O modo stream é uma **URL própria** (`?room=CÓDIGO&stream=1`), aberta como
Browser Source do OBS: a página desenha só o canvas 3D full-viewport com
fundo **transparente real** (alpha) e o resultado da rolagem com fade-out
automático — nenhum painel do app. Chroma key sólido (`&chroma=rrggbb`)
entra como alternativa para quando a fonte não aceita alpha (tela espelhada
via scrcpy/capture card). Nessa URL o cliente conecta na sala como
**espectador** (`spectator=1` no handshake WS): só recebe e anima as
rolagens dos outros, nunca rola, não aparece no roster e não conta no teto
de membros da sala.

### Sem sala é o modo padrão

O motor de regras roda sempre local, sala ou não. Criar sala só adiciona a
retransmissão — não é um pré-requisito pra rolar.

## Fluxo de uma rolagem em sala

1. Cliente calcula o resultado (parser + profile + RNG local) — instantâneo.
2. Cliente dispara a própria animação local com esse valor determinístico.
3. Em paralelo, envia o resultado já pronto pro WS.
4. Backend retransmite pra sala e grava no histórico (ordem canônica = ordem
   de chegada no servidor, não a ordem em que cada cliente termina de
   animar).
5. Outros clientes recebem e disparam a própria animação local.

A latência de rede fica escondida dentro da janela de animação (1-2s);
ninguém percebe defasagem. Exceção: reconexão/latência alta — resolvida por
guardar o último estado da sala no Redis, então quem entra ou reconecta já
recebe o snapshot atual, não só eventos futuros.

## Overlay Android — pontos específicos

- Permissão `SYSTEM_ALERT_WINDOW` só é pedida quando o usuário ativa o
  overlay explicitamente (não no primeiro boot do app).
- O socket WS vive no Foreground Service nativo (Kotlin), não na WebView —
  WebView em background fica sujeita a throttling de Doze/App Standby.
- O motor de regras (parser + profiles) roda numa WebView headless mantida
  "morna" pelo Service — sem canvas, sem WebGL, só JS puro computando.
- Nenhuma lógica de regras é duplicada em Kotlin.
- **Palco de dados 3D**: uma segunda janela de overlay com uma WebView no
  modo stream do `apps/web`. O Service **empurra** cada rolagem por
  `window.rolaiStream.play(resultado, style)` — inclusive as que chegam da
  sala pelo WebSocket dele.
  Antes o palco entrava na sala como **espectador**, uma segunda conexão WS
  por aparelho, e a animação dependia inteira dela: quando não subia, o dado
  simplesmente não aparecia, sem erro em lugar nenhum. Empurrar tira essa
  dependência e economiza uma conexão por aparelho (o teto de
  `WS_CONNECT_LIMIT_PER_MINUTE` é por IP).
  No OBS o espectador continua fazendo sentido — lá é outra máquina, sem
  ninguém pra empurrar.

Ver `specs/04-android-overlay.md` para o detalhamento de implementação.
