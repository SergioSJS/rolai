# 11 — Status do servidor (painel de /stats na web)

## Por que

O backend já publica agregados em `GET /stats` (ver `docs/security.md` e
`services/backend/app/stats.py`), mas a única forma de olhar era `curl`. Um
painel na própria aplicação responde as duas perguntas que aparecem no meio
de uma sessão: "o servidor está de pé?" e "tem alguém usando isso agora?".

Nada de identificável entra aqui — o endpoint já é agregado por decisão de
segurança, e o painel não pede nada além do que ele devolve.

## Onde mora

Item **Servidor** no menu sanduíche, abrindo o modal `stats`. É o 5º item, e
fica antes de "Sobre": olhada rara, mas é diagnóstico — quem procura, procura
no menu, não dentro do Sobre.

## O que mostra

- **Agora** (gauges lidos na hora, do Redis e da memória do processo): salas
  ativas, jogadores conectados, espectadores conectados, salas com gente.
- **Desde que o servidor ligou**: salas criadas, rolagens retransmitidas,
  jogadores e espectadores que entraram, profiles criados e expurgados.
  Com aviso explícito de que esses números ZERAM a cada restart — são sinal
  de atividade recente, não contabilidade.
- **Limites atingidos**: `limits_hit_since_boot` como lista rótulo → contagem,
  com estado vazio ("nenhum limite atingido desde o boot"). As chaves são
  dinâmicas (vêm das mesmas labels do log estruturado), então chave
  desconhecida aparece crua em vez de sumir.
- **Uptime** formatado (`3d 4h 12min`).

## Atualização

- Busca ao abrir o modal, botão **Atualizar** manual, e auto-refresh a cada
  20s.
- O auto-refresh só roda com **modal aberto**, **aba visível**
  (`visibilitychange`) e **navegador online**. `/stats` cai no teto global de
  `http_rate_limit_per_minute` (120/min por IP), o mesmo que a criação de
  sala usa: aba esquecida aberta não pode comer esse orçamento.
- Erro não apaga o que já estava na tela: mantém o último dado com o carimbo
  "atualizado há Xs" e mostra o aviso ao lado.

## Estados

| Situação | Tela |
| --- | --- |
| Primeira carga, com busca em voo | "Carregando…" |
| Primeira carga, aba em segundo plano | "pausado enquanto esta aba está em segundo plano" |
| Sucesso | tiles + limites + carimbo "atualizado há Xs" |
| Falha de rede / servidor fora | último dado (se houver) + "não foi possível alcançar o servidor" |
| Servidor aceita e não responde | erro de timeout depois de 8s |
| Offline no navegador | aviso, sem tentar buscar; volta sozinho no `online` |
| HTTP 401 | "este servidor protege o status com token" e **para** o auto-refresh |

Os dois estados que não são óbvios saíram de teste ao vivo, não de projeto:

- **"Carregando…" só quando há busca em voo.** Com a aba escondida o polling
  está suspenso de propósito; escrever "carregando" ali é dizer que busca o
  que não está sendo buscado — a família de bug que mais custou tempo neste
  repositório ("existe" no lugar de "funcionou").
- **Timeout tem que se distinguir do cancelamento.** Os dois chegam como
  `AbortError`: se o código tratar todo abort como "cancelei", o servidor que
  aceita a conexão e nunca responde deixa a tela em "Carregando…" pra sempre,
  sem erro em lugar nenhum.

A mensagem nativa do `fetch` ("Failed to fetch") não vai pra tela: vira
"não foi possível alcançar o servidor".

## Segurança

- O frontend NUNCA carrega `STATS_TOKEN`. Se o operador ligar o token, o
  painel degrada pro estado 401 acima — é o comportamento correto, não um bug
  pra "consertar" embutindo segredo no bundle.
- `apiBaseUrl()` já respeita servidor custom (runtime config / preferências),
  então o painel aponta pro mesmo backend que a sala usa.
- Toda busca tem `AbortController` com timeout: promise pendente não vira
  erro sozinha, e "não acontece nada, sem log" é a armadilha recorrente do
  projeto (AGENTS.md).

## Fora de escopo

- Histórico/sparkline entre coletas (o endpoint não guarda série temporal).
- Tela nativa no Android e qualquer coisa no modo stream/OBS — o palco do OBS
  não pode ganhar HUD.
