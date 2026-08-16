# Cobre (spec 02-backend-relay.md): criacao de sala, join com snapshot,
# broadcast entre clientes, rejeicao de payload malformado, TTL, rate limit.
import asyncio
import json
import re
from collections.abc import Callable
from typing import Any
from urllib.parse import quote

import pytest
from fakeredis.aioredis import FakeRedis
from starlette.testclient import TestClient, WebSocketTestSession
from starlette.websockets import WebSocketDisconnect

from app import rooms
from tests.conftest import assert_ws_rejected, make_roll_message

ROOM_CODE_ALPHABET = re.compile(r"^[A-Za-z0-9_-]{8}$")  # token_urlsafe(6) -> 8 chars

STYLE = {
    "body": "#aa1122",
    "number": "#ffffff",
    "outline": "#000000",
    "texture": "marble",
    "material": "metal",
}


def next_event(ws: WebSocketTestSession, skip_roster: bool = True) -> dict[str, Any]:
    """Proxima mensagem, pulando os avisos de roster (entrada/saida de
    jogador podem chegar a qualquer momento)."""
    while True:
        message: dict[str, Any] = ws.receive_json()
        if skip_roster and message["type"] == "roster":
            continue
        return message


def test_create_room_returns_unpredictable_code(client: TestClient) -> None:
    codes = {client.post("/rooms").json()["code"] for _ in range(5)}
    assert len(codes) == 5  # distintos, nao sequenciais
    for code in codes:
        assert ROOM_CODE_ALPHABET.match(code), code


def test_join_nonexistent_room_is_refused(client: TestClient) -> None:
    assert_ws_rejected(client, "/rooms/inexistente", 4404)


def test_join_sends_snapshot_with_roster_and_history(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws_a:
        assert next_event(ws_a) == {
            "type": "snapshot",
            "roster": [{"name": "Ana", "style": None}],
            "history": [],
        }
        ws_a.send_json(make_roll_message())
        next_event(ws_a)  # echo do proprio broadcast

        with client.websocket_connect(f"/rooms/{code}?name=Beto") as ws_b:
            snapshot = next_event(ws_b)
            assert snapshot["type"] == "snapshot"
            assert [m["name"] for m in snapshot["roster"]] == ["Ana", "Beto"]
            assert len(snapshot["history"]) == 1
            entry = snapshot["history"][0]
            assert entry["player"] == "Ana"
            assert entry["result"]["notation"] == "2d6"


def test_roll_broadcast_reaches_all_clients_including_sender(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with (
        client.websocket_connect(f"/rooms/{code}?name=Ana") as ws_a,
        client.websocket_connect(f"/rooms/{code}?name=Beto") as ws_b,
    ):
        next_event(ws_a)  # snapshot
        next_event(ws_b)  # snapshot
        ws_a.send_json(make_roll_message(notation="1d20", total=17))
        for ws, expected_player in ((ws_a, "Ana"), (ws_b, "Ana")):
            event = next_event(ws)
            assert event["type"] == "roll"
            assert event["player"] == expected_player
            assert event["result"]["notation"] == "1d20"


class _DeadConn:
    """Simula uma conexao cujo socket ja caiu mas cujo `finally` (que a
    tiraria do dict) ainda nao rodou — a task dela so nota o disconnect no
    proximo receive_text(), que pode ficar horas pendurado num heartbeat
    longo. E exatamente o estado que _broadcast precisa atravessar sem
    quebrar pros demais."""

    async def send_json(self, event: dict[str, object]) -> None:
        raise RuntimeError("conexao morta (simulada)")


class _RecordingConn:
    def __init__(self) -> None:
        self.received: list[dict[str, object]] = []

    async def send_json(self, event: dict[str, object]) -> None:
        self.received.append(event)


@pytest.mark.asyncio
async def test_broadcast_survives_a_dead_connection_ahead_in_the_dict() -> None:
    # Reproduz o bug ao vivo (rolagem sumia da Browser Source do OBS sem
    # erro nenhum): uma conexao morta na frente do dict derrubava o
    # _broadcast inteiro, e quem viesse DEPOIS dela na ordem de insercao
    # nunca recebia rolagem nenhuma ate o `finally` da morta rodar sozinho.
    alive = _RecordingConn()
    connections: dict[str, object] = {"morta": _DeadConn(), "viva": alive}
    await rooms._broadcast(connections, {"type": "roll", "player": "ana"})  # type: ignore[arg-type]
    assert alive.received == [{"type": "roll", "player": "ana"}]


def test_malformed_payload_rejected_without_dropping_connection(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws:
        next_event(ws)  # snapshot

        ws.send_text("isso nao e json")
        assert next_event(ws) == {"type": "error", "message": "invalid_json"}

        ws.send_json({"type": "roll", "result": {"notation": "2d6"}})  # falta groups/timestamp
        error = next_event(ws)
        assert error["type"] == "error"
        assert error["message"].startswith("invalid_event")

        ws.send_json({"type": "desconhecido"})
        error = next_event(ws)
        assert error["type"] == "error"

        # conexao continua viva: rolagem valida funciona depois dos erros
        ws.send_json(make_roll_message())
        assert next_event(ws)["type"] == "roll"


def test_oversized_message_rejected_before_parsing(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}") as ws:
        next_event(ws)  # snapshot
        ws.send_text("x" * (5 * 1024))  # > 4KB
        assert next_event(ws) == {"type": "error", "message": "message_too_large"}
        ws.send_json(make_roll_message())  # conexao segue viva
        assert next_event(ws)["type"] == "roll"


def test_room_ttl_is_set_and_renewed_on_events(
    client: TestClient, redis_client: FakeRedis
) -> None:
    code = client.post("/rooms").json()["code"]

    async def _ttl(key: str) -> int:
        return int(await redis_client.ttl(key))

    def ttl(key: str) -> int:
        return asyncio.run(_ttl(key))

    # TTL configurado na criacao (3600s no fixture)
    assert ttl(f"room:{code}") > 3500

    async def _shorten_ttl(key: str) -> None:
        await redis_client.expire(key, 5)

    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws:
        next_event(ws)  # snapshot
        # simula sala "quase expirando" e verifica que um evento renova o TTL
        asyncio.run(_shorten_ttl(f"room:{code}"))
        assert 0 < ttl(f"room:{code}") <= 5
        ws.send_json(make_roll_message())
        next_event(ws)  # echo
        assert ttl(f"room:{code}") > 3500
        assert ttl(f"room:{code}:history") > 3500
        assert ttl(f"room:{code}:roster") > 3500


def test_rate_limit_closes_connection_after_limit(
    make_client: Callable[..., TestClient],
) -> None:
    with make_client(rate_limit_per_minute=3) as client:
        code = client.post("/rooms").json()["code"]
        with client.websocket_connect(f"/rooms/{code}") as ws:
            next_event(ws)  # snapshot nao conta no bucket
            for _ in range(3):
                ws.send_json(make_roll_message())
                assert next_event(ws)["type"] == "roll"  # echo
            # 4a mensagem estoura o bucket: erro + close 1008
            ws.send_json(make_roll_message())
            assert next_event(ws) == {"type": "error", "message": "rate_limit_exceeded"}
            with pytest.raises(WebSocketDisconnect) as exc_info:
                ws.receive_json()
            assert exc_info.value.code == 1008


def test_player_style_travels_with_the_roll_and_roster(client: TestClient) -> None:
    """Cada cliente precisa animar o dado de quem rolou com a cor de quem
    rolou — entao o estilo declarado no join volta no roster e no broadcast."""
    code = client.post("/rooms").json()["code"]
    style_qs = json.dumps(STYLE)
    with client.websocket_connect(f"/rooms/{code}?name=Ana&style={quote(style_qs)}") as ws_a:
        snapshot = next_event(ws_a)
        assert snapshot["roster"] == [{"name": "Ana", "style": STYLE}]
        ws_a.send_json(make_roll_message())
        event = next_event(ws_a)
        assert event["style"] == STYLE


def test_invalid_style_is_ignored_without_breaking_the_join(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    bad = quote(json.dumps({"body": "javascript:alert(1)", "number": "#fff"}))
    with client.websocket_connect(f"/rooms/{code}?name=Ana&style={bad}") as ws:
        snapshot = next_event(ws)
        assert snapshot["roster"] == [{"name": "Ana", "style": None}]
        ws.send_json(make_roll_message())
        event = next_event(ws)
        assert event["type"] == "roll"
        assert event["style"] is None


def test_roster_broadcast_on_join_and_leave(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws_a:
        next_event(ws_a, skip_roster=False)  # snapshot
        assert ws_a.receive_json()["type"] == "roster"  # aviso da propria entrada

        with client.websocket_connect(f"/rooms/{code}?name=Beto") as ws_b:
            next_event(ws_b, skip_roster=False)  # snapshot do Beto
            roster = ws_a.receive_json()
            assert roster["type"] == "roster"
            assert [m["name"] for m in roster["roster"]] == ["Ana", "Beto"]

        # saida do Beto tambem avisa quem ficou
        roster = ws_a.receive_json()
        assert roster["type"] == "roster"
        assert [m["name"] for m in roster["roster"]] == ["Ana"]


def test_history_keeps_the_style_of_who_rolled(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=Ana&style={quote(json.dumps(STYLE))}") as ws:
        next_event(ws)
        ws.send_json(make_roll_message())
        next_event(ws)

    with client.websocket_connect(f"/rooms/{code}?name=Beto") as ws_b:
        snapshot = next_event(ws_b)
        assert snapshot["history"][0]["style"] == STYLE


# --- Sala com codigo escolhido pelo usuario (docs/security.md) ---

CODIGO_FIXO = "mesa-do-sergio-2026"


def test_custom_code_creates_room_on_join(client: TestClient) -> None:
    """Mesa fixa do OBS: a Browser Source aponta pro mesmo endereco pra
    sempre, mesmo depois do TTL derrubar a sala."""
    with client.websocket_connect(f"/rooms/{CODIGO_FIXO}?name=Sergio") as ws:
        assert next_event(ws)["type"] == "snapshot"


def test_same_custom_code_is_the_same_room(client: TestClient) -> None:
    """O ponto do link compartilhado: a segunda pessoa entra na sala da
    primeira, e nao numa sala nova. Sem isso, cada um ficaria sozinho."""
    with client.websocket_connect(f"/rooms/{CODIGO_FIXO}?name=Sergio") as ws_a:
        assert next_event(ws_a)["type"] == "snapshot"
        with client.websocket_connect(f"/rooms/{CODIGO_FIXO}?name=Beto") as ws_b:
            assert next_event(ws_b)["type"] == "snapshot"
            # A entrada de Beto chega pra Sergio: mesma sala. O primeiro
            # roster e o da propria entrada de Sergio — le ate os dois
            # aparecerem, com teto pra nao pendurar o teste.
            nomes: set[str] = set()
            for _ in range(4):
                evento = next_event(ws_a, skip_roster=False)
                if evento["type"] != "roster":
                    continue
                nomes = {m["name"] for m in evento["roster"]}
                if nomes == {"Sergio", "Beto"}:
                    break
            assert nomes == {"Sergio", "Beto"}


def test_weak_custom_code_is_still_refused(client: TestClient) -> None:
    """O codigo E a credencial (nao ha login). Codigo curto ou pobre nao
    pode virar sala, senao `?room=teste` e sala publica adivinhavel."""
    for fraco in ("teste", "aaaaaaaaaaaaaaaaaaaa", "12341234123412341234", "mesa"):
        assert_ws_rejected(client, f"/rooms/{fraco}", 4404)


def test_roll_com_keep_drop_atravessa_a_sala(client: TestClient) -> None:
    """Rolagem com keep/drop nao pode ser rejeitada no relay.

    O campo `dropped` nasceu no cliente (pra UI mostrar o pool inteiro); se
    o schema do backend nao o conhecer, `extra=forbid` derruba a rolagem e o
    dado some pra mesa toda.
    """
    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=Sergio") as ws:
        assert next_event(ws)["type"] == "snapshot"
        ws.send_json(
            {
                "type": "roll",
                "result": {
                    "notation": "4d6kh3",
                    "groups": {
                        "roll": {"rolls": [6, 4, 3], "dropped": [1], "total": 13},
                    },
                    "timestamp": "2026-08-07T00:00:00Z",
                },
            },
        )
        evento = next_event(ws)
        assert evento["type"] == "roll", evento
        assert evento["result"]["groups"]["roll"]["dropped"] == [1]
