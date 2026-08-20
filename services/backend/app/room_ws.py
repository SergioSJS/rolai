# Rotas WebSocket de sala (spec 02-backend-relay.md).
#
#
# Protocolo WS (`WS /rooms/{code}?name=<apelido>&style=<json>&spectator=1`):
#   - O apelido vem na query string `name` (default "anonymous").
#   - `style` (opcional) e a aparencia dos dados do jogador, como JSON no
#     schema DiceStyle. Invalido ou ausente = sem estilo. O backend so guarda
#     e retransmite (relay burro) — quem renderiza e o cliente.
#   - `spectator=1` (opcional) marca a conexao como espectadora (modo
#     stream/OBS): recebe snapshot com historico VAZIO e os broadcasts de
#     rolagem, mas nao entra no roster, nao conta no max_members_per_room
#     (teto proprio: settings.max_spectators_per_room) e qualquer
#     {"type":"roll"} vindo dela e rejeitado com erro, sem broadcast.
#   - Ao conectar, o servidor envia:
#       {"type": "snapshot", "roster": [RosterMember], "history": [HistoryEntry]}
#     e avisa a sala inteira com {"type": "roster", "roster": [RosterMember]}
#     (tambem quando alguem sai).
#   - O cliente envia rolagens no envelope:
#       {"type": "roll", "result": <RollResult>}
#     validado via Pydantic (nunca dict cru). O broadcast vai para TODOS os
#     conectados na sala, incluindo o remetente (serve de ack/echo):
#       {"type": "roll", "player": str, "result": <RollResult>, "style": DiceStyle|null}
#   - Baralho (specs/08-baralho.md) e local por jogador — o backend nao guarda
#     estado de monte nenhum, so retransmite e loga quem operou, MESMO
#     esquema de confianca da rolagem (relay burro, nunca valida se
#     `remaining` bate com um monte de verdade):
#       {"type": "deck_draw", "cards": [DeckCard], "remaining": int, "timestamp": str}
#       {"type": "deck_shuffle", "timestamp": str}
#       {"type": "deck_config", "include_jokers": bool?, "removal_mode": str?,
#        "auto_reshuffle_on_empty": bool?, "timestamp": str}
#     cada um faz broadcast igual ao roll (inclui remetente, ecoa "player"):
#       {"type": "deck_draw", "player": str, "cards": [...], "remaining": int, "timestamp": str}
#       {"type": "deck_shuffle", "player": str, "timestamp": str}
#       {"type": "deck_config", "player": str, "include_jokers": ..., "timestamp": str}
#   - Payload malformado (JSON invalido, envelope desconhecido, ou corpo fora
#     do schema do `type` declarado) -> {"type": "error", "message": ...} de
#     volta ao remetente, sem derrubar a conexao.
#   - Mensagem maior que settings.max_message_bytes (4KB default) e rejeitada
#     com erro ANTES de qualquer parse.
#   - Rate limit por conexao (token bucket em memoria): ao estourar, o
#     servidor envia {"type": "error", "message": "rate_limit_exceeded"} e
#     fecha a conexao com codigo 1008 (policy violation).
#   - Sala inexistente -> close 4404 (antes do accept).
#   - Heartbeat de aplicacao: se o cliente ficar ws_heartbeat_seconds sem
#     mandar nada, o servidor envia {"type":"ping"}; o cliente responde
#     {"type":"pong"}, que o loop consome em silencio (nao e rolagem).
#     Proxy com timeout ocioso (Cloudflare ~100s, NAT de rede movel) nao
#     derruba conexao parada — ver docs/security-cloudflare.md. 0 desliga.
#
# Estado da sala no Redis (TTL renovado a cada evento: entrada, saida, rolagem):
import asyncio
import json
import re
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import TypeAdapter, ValidationError

from app.config import Settings
from app.limits import client_ip, within_limit
from app.logs import log
from app.rate_limit import TokenBucket
from app.room_deps import _redis_of, _settings_of, _stats_of, _store_of
from app.room_store import RoomCapReached, RoomStore
from app.schemas import (
    ClientEventIn,
    DeckConfigEventIn,
    DeckConfigHistoryEntry,
    DeckDrawEventIn,
    DeckDrawHistoryEntry,
    DeckShuffleEventIn,
    DeckShuffleHistoryEntry,
    DiceStyle,
    HistoryEntry,
    RollEventIn,
    RollHistoryEntry,
    RosterMember,
)

router = APIRouter()

# TypeAdapter pra validar a uniao discriminada por "type" (schemas.py) —
# Pydantic nao oferece um .model_validate_json de classe pra um Union.
_CLIENT_EVENT_ADAPTER: TypeAdapter[ClientEventIn] = TypeAdapter(ClientEventIn)


async def _send_error(ws: WebSocket, message: str) -> None:
    await ws.send_json({"type": "error", "message": message})


def _parse_style(raw: str | None) -> DiceStyle | None:
    """Estilo do dado vem como JSON na query string. Invalido = sem estilo
    (o cliente cai na aparencia padrao) — nunca derruba a conexao."""
    if not raw:
        return None
    try:
        return DiceStyle.model_validate_json(raw)
    except (ValidationError, ValueError):
        return None


def _parse_styles(raw: str | None) -> dict[str, DiceStyle] | None:
    """Estilos dos 3 slots de dados (JSON na query string 'styles')."""
    if not raw:
        return None
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            parsed: dict[str, DiceStyle] = {}
            for k in ("1", "2", "3"):
                if k in data and isinstance(data[k], dict):
                    parsed[k] = DiceStyle.model_validate(data[k])
            return parsed or None
    except (json.JSONDecodeError, ValidationError, ValueError, TypeError):
        return None
    return None


def _room_dict(
    store: dict[str, dict[str, WebSocket]], code: str
) -> dict[str, WebSocket]:
    """O dict de conexoes da sala AGORA — nunca uma referencia presa de
    quando ESTA conexao entrou.

    Bug real que isto conserta: o jogador fica preso no `while True` a
    sessao inteira (horas), com `spectators` fixado no que existia no
    momento em que ele entrou. Se os espectadores zerarem em algum momento
    (a Browser Source do OBS atualizando, por exemplo) o dict e removido de
    `app.state` pelo `finally` de quem saiu, e o PROXIMO espectador a
    entrar ganha um dict NOVO. O jogador nunca fica sabendo — continua
    fazendo broadcast pro dict orfao de sempre, e a rolagem dele para de
    chegar em qualquer espectador ate ele mesmo reconectar (o que forca
    reler isto do zero). setdefault e barato: reler a cada vez, em vez de
    guardar uma vez, custa nada e fecha a janela de vez.
    """
    return store.setdefault(code, {})


async def _broadcast(connections: dict[str, WebSocket], event: dict[str, object]) -> None:
    # Uma conexao morta (socket ja caiu, mas o `finally` dela ainda nao
    # rodou — lag normal entre o disconnect acontecer e a task dela notar)
    # nao pode derrubar o broadcast pra quem continua vivo. Sem o
    # try/except, UM send falho aqui abortava o loop pro resto da lista
    # (dict preserva ordem de insercao) — quem entrou DEPOIS do morto na
    # sala simplesmente parava de receber rolagem nenhuma, sem erro visivel
    # em lugar nenhum, ate o `finally` dele mesmo limpar o dict.
    for member_id, conn in list(connections.items()):
        try:
            await conn.send_json(event)
        except Exception:  # noqa: BLE001 — send numa conexao morta pode vir
            # em qualquer tipo (ConnectionClosed, RuntimeError, etc.); o que
            # importa e nao deixar isso derrubar quem ainda esta vivo.
            log.warning("event=broadcast_send_failed member_id=%s", member_id)


# Alfabeto e tamanho aceitos numa URL de sala. Sem esse filtro, qualquer
# string vira chave no Redis.
ROOM_CODE_PATTERN = re.compile(r"^[A-Za-z0-9_-]{4,32}$")

# --- Sala com codigo escolhido pelo usuario ---
#
# Decisao consciente, registrada em docs/security.md: entrar num codigo
# inexistente CRIA a sala com aquele codigo. Serve o caso de mesa fixa (a
# Browser Source do OBS aponta pro mesmo endereco pra sempre, mesmo depois
# do TTL derrubar a sala) e o de link compartilhado que expirou — todo mundo
# que abre o link cai na MESMA sala, em vez de cada um numa sala diferente.
#
# O custo: o codigo deixa de ser so CSPRNG. Como nao ha login, o codigo E a
# credencial — `?room=teste` seria uma sala que qualquer um adivinha. Dai o
# piso de entropia abaixo, que so vale pra codigo escolhido a mao; o gerado
# pelo backend continua curto.
#
# 16 caracteres com >= 8 distintos: derruba o caso real (palavra comum,
# "teste", "aaaaaaaa...", "12341234...") sem exigir do usuario decorar algo
# impossivel. Nao e prova matematica de imprevisibilidade — e o piso que
# torna enumeracao inviavel na pratica, junto do rate limit por IP.
CUSTOM_CODE_MIN_LENGTH = 16
CUSTOM_CODE_MIN_DISTINCT = 8


def is_valid_custom_code(code: str) -> bool:
    """Codigo escolhido a mao pode virar sala nova? (ver bloco acima)"""
    if not ROOM_CODE_PATTERN.match(code):
        return False
    if len(code) < CUSTOM_CODE_MIN_LENGTH:
        return False
    return len(set(code)) >= CUSTOM_CODE_MIN_DISTINCT


async def _admit(
    websocket: WebSocket, code: str, settings: Settings, store: RoomStore
) -> str | None:
    """Aceita a conexao e decide se ela entra: formato do codigo, origem,
    limite por IP e existencia (ou criacao) da sala.

    Devolve o IP do cliente quando admitida, ou None quando ja fechou a
    conexao com o codigo de motivo. Vivia inline no comeco do room_ws, que
    passava de 280 linhas misturando isto com o loop de mensagens.
    """
    # Aceitar ANTES de qualquer validacao: um close pre-accept rejeita o
    # handshake com um HTTP de erro e o codigo NUNCA chega ao cliente — o
    # navegador reporta 1006 (erro generico de rede) e o OkHttp cai no
    # onFailure, entao "sala inexistente"/"origem proibida"/"limite" nao
    # apareciam e os clientes retentavam como se fosse queda de rede.
    # So um close DEPOIS do accept entrega 4404/4403/4429 de verdade.
    await websocket.accept()

    if not ROOM_CODE_PATTERN.match(code):
        await websocket.close(code=4404)
        return None

    ip = client_ip(websocket, settings.trust_proxy_headers)

    # CORS nao vale pra WebSocket: o navegador nao aplica same-origin aqui.
    # Origin ausente = cliente nao-navegador (app Android) e passa; Origin
    # presente tem que estar na allowlist, senao qualquer site abre conexao
    # usando o navegador de quem visita.
    origin = websocket.headers.get("origin")
    if origin is not None and settings.cors_origins and origin not in settings.cors_origins:
        log.warning("event=ws_rejected reason=origin_forbidden code=%s origin=%s ip=%s", code, origin, ip)
        _stats_of(websocket).limit_hit("origin_forbidden")
        await websocket.close(code=4403)
        return None

    if not await within_limit(
        _redis_of(websocket), f"rl:ws:{ip}", settings.ws_connect_limit_per_minute, 60
    ):
        log.warning("event=rate_limited limit=ws_connect ip=%s", ip)
        _stats_of(websocket).limit_hit("ws_connect")
        await websocket.close(code=4429)
        return None

    if not await store.exists(code):
        # Codigo escolhido a mao com entropia suficiente vira sala nova (ver
        # bloco de CUSTOM_CODE_*). Codigo curto/pobre continua dando 4404 —
        # senao `?room=teste` viraria sala publica adivinhavel.
        if not is_valid_custom_code(code):
            await websocket.close(code=4404)
            return None
        # Mesmo teto por IP do POST /rooms: sem isto, abrir WS viraria um
        # caminho paralelo pra encher o Redis, ignorando o limite do REST.
        if not await within_limit(
            _redis_of(websocket), f"rl:rooms:{ip}", settings.room_create_limit_per_hour, 3600
        ):
            log.warning("event=rate_limited limit=room_create via=ws ip=%s", ip)
            _stats_of(websocket).limit_hit("room_create")
            await websocket.close(code=4429)
            return None
        try:
            created = await store.claim(code)
        except RoomCapReached:
            log.warning("event=room_cap_reached via=ws ip=%s", code)
            _stats_of(websocket).limit_hit("room_cap")
            await websocket.close(code=4429)
            return None
        log.info("event=room_created via=ws code=%s new=%s ip=%s", code, created, ip)

    return ip


@router.websocket("/rooms/{code}")
async def room_ws(
    websocket: WebSocket,
    code: str,
    name: str = "anonymous",
    style: str | None = None,
    styles: str | None = None,
    spectator: bool = False,
) -> None:
    settings = _settings_of(websocket)
    store = _store_of(websocket)

    ip = await _admit(websocket, code, settings, store)
    if ip is None:
        return

    # Broadcast entre os conectados desta sala, em memoria (single-process).
    # Jogadores e espectadores ficam em mapas separados: espectador nao
    # aparece no roster nem conta no teto de membros.
    connections: dict[str, WebSocket] = websocket.app.state.room_connections.setdefault(code, {})
    spectators: dict[str, WebSocket] = websocket.app.state.room_spectators.setdefault(code, {})
    # Teto de gente por sala: cada rolagem e retransmitida pra todo mundo,
    # entao N conexoes numa sala multiplicam o trafego por N.
    if spectator:
        if settings.max_spectators_per_room > 0 and (
            len(spectators) >= settings.max_spectators_per_room
        ):
            log.warning(
                "event=rate_limited limit=max_spectators_per_room code=%s ip=%s", code, ip
            )
            _stats_of(websocket).limit_hit("spectator_cap")
            await websocket.close(code=4429)
            return
    elif settings.max_members_per_room > 0 and len(connections) >= settings.max_members_per_room:
        log.warning("event=rate_limited limit=max_members_per_room code=%s ip=%s", code, ip)
        _stats_of(websocket).limit_hit("member_cap")
        await websocket.close(code=4429)
        return

    # Apelido cru vem da query string: corta no limite antes de guardar e
    # retransmitir (o front ja limita, um bot nao).
    name = name.strip()[: settings.max_name_length] or "anonymous"

    member_id = uuid.uuid4().hex
    dice_styles = _parse_styles(styles)
    dice_style = _parse_style(style)
    if dice_style is None and dice_styles is not None:
        dice_style = dice_styles.get("1")

    role = "spectator" if spectator else "player"
    if spectator:
        spectators[member_id] = websocket
    else:
        await store.add_member(code, member_id, name, dice_style, dice_styles)
        connections[member_id] = websocket
    log.info("event=ws_open code=%s role=%s player=%s ip=%s", code, role, name, ip)
    _stats_of(websocket).ws_opened(spectator)

    limit = settings.rate_limit_per_minute
    bucket = TokenBucket(rate_per_second=limit / 60.0, capacity=float(limit))

    def roster_payload(members: list[RosterMember]) -> list[dict[str, object]]:
        payload: list[dict[str, object]] = []
        for m in members:
            item: dict[str, object] = {
                "name": m.name,
                "style": m.style.model_dump(mode="json") if m.style else None,
            }
            if m.styles is not None:
                item["styles"] = {k: v.model_dump(mode="json") for k, v in m.styles.items()}
            payload.append(item)
        return payload

    # Nota: o RollResult vai com exclude_none — campo opcional ausente, nunca
    # null. O contrato TS (docs/roll-notation.md) usa `campo?: tipo`, e um
    # null explicito virava "= null" na UI.

    try:
        await websocket.send_json(
            {
                "type": "snapshot",
                "roster": roster_payload(await store.roster(code)),
                # Espectador so anima rolagens NOVAS: entrar no meio da
                # sessao e animar o historico inteiro de uma vez seria
                # bizarro na stream — o snapshot dele vai sem historico.
                "history": (
                    []
                    if spectator
                    else [
                        e.model_dump(mode="json", exclude_none=True)
                        for e in await store.history(code)
                    ]
                ),
            }
        )
        # Quem ja estava na sala precisa saber que chegou gente (e com que
        # cor de dado) — antes o roster so vinha no snapshot de cada um.
        # Espectador nao entra no roster, entao nao gera aviso.
        if not spectator:
            await _broadcast(
                _room_dict(websocket.app.state.room_connections, code),
                {"type": "roster", "roster": roster_payload(await store.roster(code))},
            )
        heartbeat = settings.ws_heartbeat_seconds
        while True:
            try:
                raw = await asyncio.wait_for(
                    websocket.receive_text(), timeout=heartbeat if heartbeat > 0 else None
                )
            except TimeoutError:
                # Cliente ocioso: heartbeat de aplicacao (ver cabecalho do
                # modulo). O send fica nesta mesma task — nada de writer
                # concorrente no socket.
                await websocket.send_json({"type": "ping"})
                continue
            if len(raw.encode("utf-8")) > settings.max_message_bytes:
                log.warning(
                    "event=payload_rejected reason=message_too_large code=%s player=%s", code, name
                )
                await _send_error(websocket, "message_too_large")
                continue
            if not bucket.allow():
                log.warning(
                    "event=rate_limited limit=ws_messages code=%s player=%s ip=%s", code, name, ip
                )
                await _send_error(websocket, "rate_limit_exceeded")
                await websocket.close(code=1008)
                break
            if _is_pong(raw):
                continue  # resposta ao heartbeat — nao e rolagem
            event_in = await _parse_client_event(websocket, raw, code, name)
            if event_in is None:
                continue  # erro ja enviado ao remetente
            if spectator:
                # Espectador nunca rola nem mexe no proprio baralho em sala:
                # erro ao remetente, nada vai pro broadcast nem pro historico.
                await _send_error(websocket, "spectator_cannot_roll")
                continue
            entry: HistoryEntry
            event: dict[str, object]
            if isinstance(event_in, RollEventIn):
                # `style` e `styles` acompanham a rolagem: cada cliente anima o dado de
                # quem rolou com as cores de quem rolou, e nao com as proprias.
                entry = RollHistoryEntry(
                    player=name,
                    result=event_in.result,
                    style=dice_style,
                    styles=dice_styles,
                )
                event = {
                    "type": "roll",
                    "player": name,
                    "result": event_in.result.model_dump(mode="json", exclude_none=True),
                    "style": dice_style.model_dump(mode="json") if dice_style else None,
                }
                if dice_styles is not None:
                    event["styles"] = {k: v.model_dump(mode="json") for k, v in dice_styles.items()}
                _stats_of(websocket).rolls_relayed += 1
            elif isinstance(event_in, DeckDrawEventIn):
                entry = DeckDrawHistoryEntry(
                    player=name,
                    cards=event_in.cards,
                    remaining=event_in.remaining,
                    timestamp=event_in.timestamp,
                )
                event = {
                    "type": "deck_draw",
                    "player": name,
                    "cards": [c.model_dump(mode="json") for c in event_in.cards],
                    "remaining": event_in.remaining,
                    "timestamp": event_in.timestamp,
                }
            elif isinstance(event_in, DeckShuffleEventIn):
                entry = DeckShuffleHistoryEntry(player=name, timestamp=event_in.timestamp)
                event = {"type": "deck_shuffle", "player": name, "timestamp": event_in.timestamp}
            elif isinstance(event_in, DeckConfigEventIn):
                entry = DeckConfigHistoryEntry(
                    player=name,
                    include_jokers=event_in.include_jokers,
                    removal_mode=event_in.removal_mode,
                    auto_reshuffle_on_empty=event_in.auto_reshuffle_on_empty,
                    timestamp=event_in.timestamp,
                )
                event = {
                    "type": "deck_config",
                    "player": name,
                    "include_jokers": event_in.include_jokers,
                    "removal_mode": event_in.removal_mode,
                    "auto_reshuffle_on_empty": event_in.auto_reshuffle_on_empty,
                    "timestamp": event_in.timestamp,
                }
            else:
                # Inalcancavel: ClientEventIn cobre exatamente estes 4 tipos
                # (schemas.py). Explicito em vez de um `else` silencioso pra
                # nao esconder um tipo novo esquecido aqui se a uniao crescer.
                raise TypeError(f"tipo de evento nao tratado: {event_in.type}")
            await store.append_history(code, entry)
            # Espectadores recebem o broadcast tambem — e o que alimenta a
            # animacao da Browser Source do OBS. `_room_dict` de novo aqui
            # (nao os `connections`/`spectators` capturados la em cima): esta
            # conexao pode estar neste loop ha horas, e o dict certo e o de
            # AGORA, nao o de quando ela entrou (ver docstring de _room_dict).
            await _broadcast(_room_dict(websocket.app.state.room_connections, code), event)
            await _broadcast(_room_dict(websocket.app.state.room_spectators, code), event)
    except WebSocketDisconnect:
        pass
    finally:
        log.info("event=ws_closed code=%s role=%s player=%s", code, role, name)
        if spectator:
            current_spectators = _room_dict(websocket.app.state.room_spectators, code)
            current_spectators.pop(member_id, None)
            if not current_spectators:
                websocket.app.state.room_spectators.pop(code, None)
        else:
            current_connections = _room_dict(websocket.app.state.room_connections, code)
            current_connections.pop(member_id, None)
            if not current_connections:
                websocket.app.state.room_connections.pop(code, None)
            await store.remove_member(code, member_id)
            if current_connections:
                await _broadcast(
                    current_connections,
                    {"type": "roster", "roster": roster_payload(await store.roster(code))},
                )


def _is_pong(raw: str) -> bool:
    """Resposta do cliente ao {"type":"ping"} do heartbeat. Sem este filtro
    o pong cairia na validacao de ClientEventIn e voltaria erro pro remetente
    a cada heartbeat."""
    try:
        data: object = json.loads(raw)
    except json.JSONDecodeError:
        return False
    return isinstance(data, dict) and data.get("type") == "pong"


async def _parse_client_event(
    websocket: WebSocket, raw: str, code: str, player: str
) -> ClientEventIn | None:
    """Valida o envelope contra a uniao discriminada por "type" (roll ou
    deck_*) via Pydantic. Erros viram mensagem de erro ao remetente (sem
    derrubar a conexao) e retorno None. Loga so o motivo — nunca o payload
    (ruido, e pode ser rolagem)."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        log.warning("event=payload_rejected reason=invalid_json code=%s player=%s", code, player)
        await _send_error(websocket, "invalid_json")
        return None
    try:
        return _CLIENT_EVENT_ADAPTER.validate_python(data)
    except ValidationError as exc:
        log.warning("event=payload_rejected reason=invalid_event code=%s player=%s", code, player)
        await _send_error(websocket, f"invalid_event: {exc.errors()[0]['msg']}")
        return None
