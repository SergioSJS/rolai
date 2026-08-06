# GET /stats: agregados de atividade (docs/security.md). Nada identificavel —
# sem codigo de sala, apelido ou IP.
from collections.abc import Callable

from starlette.testclient import TestClient

from tests.conftest import make_roll_message
from tests.test_rooms import next_event


def test_stats_counts_rooms_rolls_and_connections(client: TestClient) -> None:
    zero = client.get("/stats").json()
    assert zero["rooms"]["created_since_boot"] == 0
    assert zero["connections"]["players_now"] == 0

    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws:
        next_event(ws)
        ws.send_json(make_roll_message())
        next_event(ws)

        live = client.get("/stats").json()
        assert live["rooms"] == {"active": 1, "created_since_boot": 1}
        assert live["rolls_relayed_since_boot"] == 1
        assert live["connections"]["players_now"] == 1
        assert live["connections"]["players_since_boot"] == 1
        assert live["uptime_seconds"] >= 0

    # gauge acompanha a saida; contador desde o boot nao volta atras
    after = client.get("/stats").json()
    assert after["connections"]["players_now"] == 0
    assert after["connections"]["players_since_boot"] == 1


def test_stats_separates_spectators(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with (
        client.websocket_connect(f"/rooms/{code}?name=Ana") as ws,
        client.websocket_connect(f"/rooms/{code}&spectator=1".replace("&", "?", 1)) as obs,
    ):
        next_event(ws)
        next_event(obs)
        body = client.get("/stats").json()
        assert body["connections"]["players_now"] == 1
        assert body["connections"]["spectators_now"] == 1
        assert body["connections"]["spectators_since_boot"] == 1


def test_stats_records_limits_hit(make_client: Callable[..., TestClient]) -> None:
    """O sinal de 'estao batendo na porta agora'."""
    with make_client(room_create_limit_per_hour=1) as client:
        client.post("/rooms")
        assert client.post("/rooms").status_code == 429
        assert client.get("/stats").json()["limits_hit_since_boot"] == {"room_create": 1}


def test_stats_token_protects_the_endpoint(make_client: Callable[..., TestClient]) -> None:
    with make_client(stats_token="segredo") as client:
        assert client.get("/stats").status_code == 401
        assert client.get("/stats", headers={"Authorization": "Bearer errado"}).status_code == 401
        ok = client.get("/stats", headers={"Authorization": "Bearer segredo"})
        assert ok.status_code == 200


def test_stats_leaks_nothing_identifiable(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=ApelidoSecreto") as ws:
        next_event(ws)
        body = client.get("/stats").text
        assert code not in body
        assert "ApelidoSecreto" not in body
        assert "testclient" not in body  # nem IP
