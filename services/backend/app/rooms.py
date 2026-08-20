# Sala: agregador das rotas e das rotas REST (spec 02-backend-relay.md).
#
# O modulo tinha 790 linhas com quatro papeis dentro: estado no Redis, REST,
# export e o WebSocket. Cada um foi pra um arquivo, e este ficou com o que
# de fato e "rota HTTP de sala" mais o router que o main.py inclui:
#
#   app/room_store.py   estado no Redis (RoomStore, tetos, TTL)
#   app/room_deps.py    acessores do app.state
#   app/room_export.py  historico em CSV/Markdown
#   app/room_ws.py      protocolo WebSocket (o relay em si)
import json
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

from app.limits import client_ip, within_limit
from app.logs import log
from app.room_deps import _redis_of, _settings_of, _stats_of, _store_of
from app.room_export import _history_csv, _history_markdown
from app.room_store import RoomCapReached
from app.room_ws import ROOM_CODE_PATTERN
from app.room_ws import router as ws_router
from app.schemas import RoomCreated

router = APIRouter()
# O WS vive em room_ws.py, mas continua entrando pelo mesmo include_router
# do main.py — quem consome nao precisa saber que foram separados.
router.include_router(ws_router)


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
