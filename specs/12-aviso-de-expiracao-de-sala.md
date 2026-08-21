# 12 — Avisar que a sala expira

## Por que

O backend apaga a sala depois de `ROOM_TTL_SECONDS` (6h no padrão,
`services/backend/app/config.py`), e o TTL **renova a cada atividade**
(`room_store._refresh_ttl`): é tempo de silêncio, não idade da sala.

Nada disso aparecia em lugar nenhum da UI — nem na web, nem no APK, nem na
Ajuda. O `POST /rooms` até devolve `ttl_seconds`, mas `createRoom()` lia só o
`code` e jogava o resto fora.

O que morde não é o código sumir — esse volta a funcionar assim que alguém
entra de novo (`claim()` com `NX`, e é o que faz mesa fixa/Browser Source do
OBS seguir valendo). O que some pra sempre é o **histórico**: `room:*:history`
tem o mesmo TTL, então o export volta vazio depois disso.

## Onde o aviso aparece

- **Sala, antes de entrar**: abaixo de Criar/Entrar. É o único momento em que
  dá pra escolher código fixo em vez de aleatório sabendo o que isso muda.
- **Sala, dentro dela**: em "Exportar histórico", que é onde a perda concreta
  mora — "exporte o que quiser guardar".
- **Ajuda**: bloco "Salas", junto do resto do que a pessoa precisa saber pra
  usar o app.

Fora de escopo por ora: app Android e painel Servidor.

## De onde vem o número

`apps/web/src/roomTtl.ts`, com duas fontes porque quem **cria** e quem
**entra** recebem coisas diferentes:

1. `POST /rooms` devolve `ttl_seconds` — `createRoom()` guarda no cache de
   graça, sem request extra.
2. Quem só entra nunca vê esse corpo: o valor vem de `GET /stats`, que passou
   a publicar `rooms.ttl_seconds` (é config, não dado de ninguém).

O cache é de módulo, com a busca em voo compartilhada — Sala e Ajuda abrindo
uma atrás da outra não geram duas chamadas.

## Quando o número não existe

Servidor fora do ar, protegido por `STATS_TOKEN`, ou velho demais pra ter o
campo (o parse devolve 0): a frase sai **sem número** — "algumas horas sem
ninguém rolar nada". Avisar que expira importa mais do que dizer em quantas
horas, e prometer "0 hora" seria pior que não prometer nada.

Texto escrito num lugar só (`ttlPhrase`): o aviso aparece em três telas e não
pode divergir entre elas.
