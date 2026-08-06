# Heartbeat do WS (docs/security-cloudflare.md): o servidor envia
# {"type":"ping"} em conexao ociosa e o {"type":"pong"} do cliente e
# consumido em silencio — nao vira erro de "rolagem invalida".
import json
from collections.abc import Callable

from starlette.testclient import TestClient

from tests.conftest import make_roll_message
from tests.test_rooms import next_event


def test_idle_connection_receives_ping(make_client: Callable[..., TestClient]) -> None:
    """Proxy com timeout ocioso (Cloudflare ~100s) derruba conexao parada;
    o ping mantem o caminho quente."""
    with make_client(ws_heartbeat_seconds=0.1) as client:
        code = client.post("/rooms").json()["code"]
        with client.websocket_connect(f"/rooms/{code}") as ws:
            assert next_event(ws)["type"] == "snapshot"
            assert next_event(ws)["type"] == "ping"


def test_pong_gets_no_error_and_is_not_a_roll(make_client: Callable[..., TestClient]) -> None:
    """Sem o filtro, o pong cairia no RollEventIn e voltaria
    {"type":"error"} pro remetente a cada heartbeat."""
    with make_client(ws_heartbeat_seconds=0) as client:
        code = client.post("/rooms").json()["code"]
        with client.websocket_connect(f"/rooms/{code}") as ws:
            assert next_event(ws)["type"] == "snapshot"
            ws.send_text('{"type":"pong"}')
            ws.send_text(json.dumps(make_roll_message()))
            # Se o pong tivesse gerado erro, ele chegaria ANTES do roll.
            assert next_event(ws)["type"] == "roll"
