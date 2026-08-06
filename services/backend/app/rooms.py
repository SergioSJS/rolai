# Logica de sala + rotas HTTP/WS (spec 02-backend-relay.md).
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
#   - Payload malformado (JSON invalido, envelope desconhecido, RollResult
#     fora do schema) -> {"type": "error", "message": ...} de volta ao
#     remetente, sem derrubar a conexao.
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
#   room:{code}          string "1"  — marcador de existencia da sala
#   room:{code}:roster   hash member_id -> nome
#   room:{code}:history  list de HistoryEntry serializado (capado em
#                        settings.history_max_entries)
#   rooms:active         set com o codigo de cada sala viva — teto global de
#                        salas (settings.max_active_rooms), prunado a cada
#                        criacao (sala expirada some do set)
import asyncio
import csv
import io
import json
import re
import secrets
import uuid
from typing import TYPE_CHECKING, Literal

from fastapi import APIRouter, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import PlainTextResponse
from pydantic import ValidationError
from redis.asyncio import Redis

from app.config import Settings
from app.limits import client_ip, within_limit
from app.logs import log
from app.rate_limit import TokenBucket
from app.schemas import DiceStyle, HistoryEntry, RollEventIn, RoomCreated, RosterMember

if TYPE_CHECKING:
    from app.stats import StatsCollector

router = APIRouter()

MAX_CODE_RETRIES = 10

ACTIVE_ROOMS_KEY = "rooms:active"


class RoomCapReached(Exception):
    """Teto global de salas ativas (settings.max_active_rooms) atingido."""


def generate_room_code(length_bytes: int = 6) -> str:
    """Codigo de sala via CSPRNG — nunca sequencial (docs/security.md)."""
    return secrets.token_urlsafe(length_bytes)


class RoomStore:
    """Operacoes de estado da sala em cima do Redis. Relay burro: guarda e
    devolve payloads ja validados, sem recalcular nada."""

    def __init__(self, redis: Redis, settings: Settings) -> None:
        self._redis = redis
        self._settings = settings

    def _key(self, code: str, suffix: str = "") -> str:
        return f"room:{code}{suffix}"

    async def claim(self, code: str) -> bool:
        """Cria a sala COM o codigo pedido. False = o codigo ja existia.

        NX: se duas pessoas abrirem o mesmo link ao mesmo tempo, a primeira
        cria e a segunda entra na sala da primeira — nunca duas salas com o
        mesmo codigo, nunca uma sobrescrevendo a outra.
        """
        await self._enforce_room_cap()
        if not await self._redis.set(self._key(code), "1", nx=True):
            return False
        await self._redis.sadd(ACTIVE_ROOMS_KEY, code)
        await self._refresh_ttl(code)
        return True

    async def create(self) -> str:
        await self._enforce_room_cap()
        for _ in range(MAX_CODE_RETRIES):
            code = generate_room_code()
            # NX: colisao (astronomicamente improvavel) tenta outro codigo.
            if await self._redis.set(self._key(code), "1", nx=True):
                await self._redis.sadd(ACTIVE_ROOMS_KEY, code)
                await self._refresh_ttl(code)
                return code
        raise RuntimeError("falha ao gerar codigo de sala unico")

    async def _enforce_room_cap(self) -> None:
        """Teto GLOBAL de salas ativas (docs/security.md): o limite por IP
        barra um bot, mas N bots com N IPs ainda enchem o Redis. 0 desliga."""
        limit = self._settings.max_active_rooms
        if limit <= 0:
            return
        await self._prune_active_rooms()
        if await self._redis.scard(ACTIVE_ROOMS_KEY) >= limit:
            raise RoomCapReached

    async def _prune_active_rooms(self) -> None:
        """O set nao tem TTL por membro: sala cuja chave marcador expirou sai
        do set aqui, senao o teto global contaria sala morta. Salas sao
        poucas — um EXISTS por membro (pipeline) e irrelevante de custo."""
        # decode_responses=True em todo cliente Redis da app: os stubs do
        # redis-py declaram bytes|str, mas em runtime e sempre str.
        members = {str(code) for code in await self._redis.smembers(ACTIVE_ROOMS_KEY)}
        if not members:
            return
        pipe = self._redis.pipeline(transaction=False)
        for code in members:
            pipe.exists(self._key(code))
        exists_flags = await pipe.execute()
        expired = [code for code, exists in zip(members, exists_flags, strict=True) if not exists]
        if expired:
            await self._redis.srem(ACTIVE_ROOMS_KEY, *expired)

    async def exists(self, code: str) -> bool:
        return bool(await self._redis.exists(self._key(code)))

    async def _refresh_ttl(self, code: str) -> None:
        ttl = self._settings.room_ttl_seconds
        for suffix in ("", ":roster", ":history"):
            await self._redis.expire(self._key(code, suffix), ttl)

    async def add_member(
        self, code: str, member_id: str, name: str, style: DiceStyle | None = None
    ) -> None:
        member = RosterMember(name=name, style=style)
        await self._redis.hset(self._key(code, ":roster"), member_id, member.model_dump_json())
        await self._refresh_ttl(code)

    async def remove_member(self, code: str, member_id: str) -> None:
        await self._redis.hdel(self._key(code, ":roster"), member_id)
        await self._refresh_ttl(code)

    async def roster(self, code: str) -> list[RosterMember]:
        values = await self._redis.hvals(self._key(code, ":roster"))
        members = [RosterMember.model_validate_json(v) for v in values]
        return sorted(members, key=lambda m: m.name)

    async def append_roll(self, code: str, entry: HistoryEntry) -> None:
        key = self._key(code, ":history")
        await self._redis.rpush(key, entry.model_dump_json())
        await self._redis.ltrim(key, -self._settings.history_max_entries, -1)
        await self._refresh_ttl(code)

    async def history(self, code: str) -> list[HistoryEntry]:
        raw = await self._redis.lrange(self._key(code, ":history"), 0, -1)
        return [HistoryEntry.model_validate_json(item) for item in raw]


def _settings_of(request_or_ws: Request | WebSocket) -> Settings:
    settings: Settings = request_or_ws.app.state.settings
    return settings


def _store_of(request_or_ws: Request | WebSocket) -> RoomStore:
    store: RoomStore = request_or_ws.app.state.room_store
    return store


def _redis_of(request_or_ws: Request | WebSocket) -> Redis:
    redis: Redis = request_or_ws.app.state.redis
    return redis


def _stats_of(request_or_ws: Request | WebSocket) -> "StatsCollector":
    """Contadores de /stats. Import so em type-check: app.stats importa
    ACTIVE_ROOMS_KEY daqui, e o ciclo quebraria no runtime."""
    collector: StatsCollector = request_or_ws.app.state.stats
    return collector


# --- HTTP ---


@router.post("/rooms", status_code=201)
async def create_room(request: Request) -> RoomCreated:
    settings = _settings_of(request)
    # Sala e estado persistente (chave no Redis com TTL de horas): sem teto
    # por IP, um bot enche a memoria do Redis em minutos.
    ip = client_ip(request, settings.trust_proxy_headers)
    if not await within_limit(
        _redis_of(request),
        f"rl:rooms:{ip}",
        settings.room_create_limit_per_hour,
        3600,
    ):
        log.warning("event=rate_limited limit=room_create ip=%s", ip)
        _stats_of(request).limit_hit("room_create")
        raise HTTPException(
            status_code=429,
            detail="limite de criacao de salas excedido",
            headers={"Retry-After": "3600"},
        )
    store = _store_of(request)
    try:
        code = await store.create()
    except RoomCapReached:
        # 503 (nao 429): o teto global e uma condicao de capacidade do
        # servico, nao algo que ESTE cliente tenha causado — Retry-After diz
        # que vagas abrem quando salas expirarem.
        log.warning("event=room_cap_reached ip=%s", ip)
        _stats_of(request).limit_hit("room_cap")
        raise HTTPException(
            status_code=503,
            detail="teto global de salas ativas atingido",
            headers={"Retry-After": "3600"},
        ) from None
    log.info("event=room_created code=%s ip=%s", code, ip)
    _stats_of(request).rooms_created += 1
    return RoomCreated(code=code, ttl_seconds=settings.room_ttl_seconds)


@router.get("/rooms/{code}/export")
async def export_room(
    request: Request,
    code: str,
    format: Literal["json", "csv", "md"] = Query(default="json"),
) -> PlainTextResponse:
    store = _store_of(request)
    if not ROOM_CODE_PATTERN.match(code) or not await store.exists(code):
        raise HTTPException(status_code=404, detail="sala nao encontrada")
    history = await store.history(code)
    if format == "json":
        payload = {
            "room": code,
            "history": [e.model_dump(mode="json", exclude_none=True) for e in history],
        }
        return PlainTextResponse(
            json.dumps(payload, ensure_ascii=False, indent=2),
            media_type="application/json",
        )
    if format == "csv":
        return PlainTextResponse(_history_csv(history), media_type="text/csv")
    return PlainTextResponse(_history_markdown(code, history), media_type="text/markdown")


def _history_row(entry: HistoryEntry) -> list[str]:
    r = entry.result
    return [
        r.timestamp,
        entry.player,
        r.notation,
        r.profile or "",
        r.outcome or "",
        "|".join(r.outcome_flags or []),
    ]


_CSV_HEADER = ["timestamp", "player", "notation", "profile", "outcome", "outcome_flags"]


def _history_csv(history: list[HistoryEntry]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(_CSV_HEADER)
    for entry in history:
        writer.writerow(_history_row(entry))
    return buf.getvalue()


def _history_markdown(code: str, history: list[HistoryEntry]) -> str:
    lines = [f"# Sala {code}", "", "| " + " | ".join(_CSV_HEADER) + " |"]
    lines.append("| " + " | ".join("---" for _ in _CSV_HEADER) + " |")
    for entry in history:
        lines.append("| " + " | ".join(_history_row(entry)) + " |")
    return "\n".join(lines) + "\n"


# --- WebSocket ---


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


async def _broadcast(connections: dict[str, WebSocket], event: dict[str, object]) -> None:
    for conn in list(connections.values()):
        await conn.send_json(event)


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


@router.websocket("/rooms/{code}")
async def room_ws(
    websocket: WebSocket,
    code: str,
    name: str = "anonymous",
    style: str | None = None,
    spectator: bool = False,
) -> None:
    settings = _settings_of(websocket)
    store = _store_of(websocket)

    # Aceitar ANTES de qualquer validacao: um close pre-accept rejeita o
    # handshake com um HTTP de erro e o codigo NUNCA chega ao cliente — o
    # navegador reporta 1006 (erro generico de rede) e o OkHttp cai no
    # onFailure, entao "sala inexistente"/"origem proibida"/"limite" nao
    # apareciam e os clientes retentavam como se fosse queda de rede.
    # So um close DEPOIS do accept entrega 4404/4403/4429 de verdade.
    await websocket.accept()

    if not ROOM_CODE_PATTERN.match(code):
        await websocket.close(code=4404)
        return

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
        return

    if not await within_limit(
        _redis_of(websocket), f"rl:ws:{ip}", settings.ws_connect_limit_per_minute, 60
    ):
        log.warning("event=rate_limited limit=ws_connect ip=%s", ip)
        _stats_of(websocket).limit_hit("ws_connect")
        await websocket.close(code=4429)
        return

    if not await store.exists(code):
        # Codigo escolhido a mao com entropia suficiente vira sala nova (ver
        # bloco de CUSTOM_CODE_*). Codigo curto/pobre continua dando 4404 —
        # senao `?room=teste` viraria sala publica adivinhavel.
        if not is_valid_custom_code(code):
            await websocket.close(code=4404)
            return
        # Mesmo teto por IP do POST /rooms: sem isto, abrir WS viraria um
        # caminho paralelo pra encher o Redis, ignorando o limite do REST.
        if not await within_limit(
            _redis_of(websocket), f"rl:rooms:{ip}", settings.room_create_limit_per_hour, 3600
        ):
            log.warning("event=rate_limited limit=room_create via=ws ip=%s", ip)
            _stats_of(websocket).limit_hit("room_create")
            await websocket.close(code=4429)
            return
        try:
            created = await store.claim(code)
        except RoomCapReached:
            log.warning("event=room_cap_reached via=ws ip=%s", ip)
            _stats_of(websocket).limit_hit("room_cap")
            await websocket.close(code=4429)
            return
        log.info("event=room_created via=ws code=%s new=%s ip=%s", code, created, ip)

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
    dice_style = _parse_style(style)
    role = "spectator" if spectator else "player"
    if spectator:
        spectators[member_id] = websocket
    else:
        await store.add_member(code, member_id, name, dice_style)
        connections[member_id] = websocket
    log.info("event=ws_open code=%s role=%s player=%s ip=%s", code, role, name, ip)
    _stats_of(websocket).ws_opened(spectator)

    limit = settings.rate_limit_per_minute
    bucket = TokenBucket(rate_per_second=limit / 60.0, capacity=float(limit))

    def roster_payload(members: list[RosterMember]) -> list[dict[str, object]]:
        return [m.model_dump(mode="json") for m in members]

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
                connections,
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
            event_in = await _parse_roll_event(websocket, raw, code, name)
            if event_in is None:
                continue  # erro ja enviado ao remetente
            if spectator:
                # Espectador nunca rola: erro ao remetente, nada vai pro
                # broadcast nem pro historico.
                await _send_error(websocket, "spectator_cannot_roll")
                continue
            entry = HistoryEntry(player=name, result=event_in.result, style=dice_style)
            # `style` acompanha a rolagem: cada cliente anima o dado de quem
            # rolou com a cor de quem rolou, e nao com a propria.
            event: dict[str, object] = {
                "type": "roll",
                "player": name,
                "result": event_in.result.model_dump(mode="json", exclude_none=True),
                "style": dice_style.model_dump(mode="json") if dice_style else None,
            }
            await store.append_roll(code, entry)
            # Espectadores recebem o broadcast tambem — e o que alimenta a
            # animacao da Browser Source do OBS.
            await _broadcast(connections, event)
            await _broadcast(spectators, event)
            _stats_of(websocket).rolls_relayed += 1
    except WebSocketDisconnect:
        pass
    finally:
        log.info("event=ws_closed code=%s role=%s player=%s", code, role, name)
        if spectator:
            spectators.pop(member_id, None)
            if not spectators:
                websocket.app.state.room_spectators.pop(code, None)
        else:
            connections.pop(member_id, None)
            if not connections:
                websocket.app.state.room_connections.pop(code, None)
            await store.remove_member(code, member_id)
            if connections:
                await _broadcast(
                    connections,
                    {"type": "roster", "roster": roster_payload(await store.roster(code))},
                )


def _is_pong(raw: str) -> bool:
    """Resposta do cliente ao {"type":"ping"} do heartbeat. Sem este filtro
    o pong cairia na validacao de RollEventIn e voltaria erro pro remetente
    a cada heartbeat."""
    try:
        data: object = json.loads(raw)
    except json.JSONDecodeError:
        return False
    return isinstance(data, dict) and data.get("type") == "pong"


async def _parse_roll_event(
    websocket: WebSocket, raw: str, code: str, player: str
) -> RollEventIn | None:
    """Valida o envelope e o RollResult via Pydantic. Erros viram mensagem
    de erro ao remetente (sem derrubar a conexao) e retorno None. Loga so o
    motivo — nunca o payload da rolagem (ruido)."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        log.warning("event=payload_rejected reason=invalid_json code=%s player=%s", code, player)
        await _send_error(websocket, "invalid_json")
        return None
    try:
        return RollEventIn.model_validate(data)
    except ValidationError as exc:
        log.warning("event=payload_rejected reason=invalid_roll code=%s player=%s", code, player)
        await _send_error(websocket, f"invalid_roll: {exc.errors()[0]['msg']}")
        return None
