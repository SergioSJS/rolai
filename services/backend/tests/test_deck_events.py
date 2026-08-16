# Eventos de baralho (specs/08-baralho.md): deck_draw/deck_shuffle/deck_config.
# Mesmo modelo de confianca da rolagem — o backend so valida FORMA e
# retransmite/loga; baralho e local por jogador, nao ha estado de monte no
# servidor. Cobre o pedido original: log de quem operou o baralho na sala.
from starlette.testclient import TestClient

from tests.test_rooms import next_event

DRAW_MESSAGE = {
    "type": "deck_draw",
    "cards": [
        {"id": "hearts-A", "suit": "hearts", "rank": "A"},
        {"id": "spades-Q", "suit": "spades", "rank": "Q"},
    ],
    "remaining": 50,
    "timestamp": "2026-01-01T00:00:00Z",
}


def test_deck_draw_broadcast_reaches_all_clients_including_sender(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with (
        client.websocket_connect(f"/rooms/{code}?name=Ana") as ws_a,
        client.websocket_connect(f"/rooms/{code}?name=Beto") as ws_b,
    ):
        next_event(ws_a)  # snapshot
        next_event(ws_b)  # snapshot
        ws_a.send_json(DRAW_MESSAGE)
        for ws, expected_player in ((ws_a, "Ana"), (ws_b, "Ana")):
            event = next_event(ws)
            assert event["type"] == "deck_draw"
            assert event["player"] == expected_player
            assert event["remaining"] == 50
            assert [c["id"] for c in event["cards"]] == ["hearts-A", "spades-Q"]


def test_deck_shuffle_and_config_broadcast_and_log_the_actor(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws:
        next_event(ws)  # snapshot

        ws.send_json({"type": "deck_shuffle", "timestamp": "2026-01-01T00:00:01Z"})
        shuffle_event = next_event(ws)
        assert shuffle_event == {
            "type": "deck_shuffle",
            "player": "Ana",
            "timestamp": "2026-01-01T00:00:01Z",
        }

        ws.send_json(
            {
                "type": "deck_config",
                "include_jokers": True,
                "timestamp": "2026-01-01T00:00:02Z",
            }
        )
        config_event = next_event(ws)
        assert config_event["type"] == "deck_config"
        assert config_event["player"] == "Ana"
        assert config_event["include_jokers"] is True
        assert config_event["removal_mode"] is None


def test_deck_events_land_in_history_alongside_rolls(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws_a:
        next_event(ws_a)  # snapshot
        ws_a.send_json(DRAW_MESSAGE)
        next_event(ws_a)  # echo

        with client.websocket_connect(f"/rooms/{code}?name=Beto") as ws_b:
            snapshot = next_event(ws_b)
            assert len(snapshot["history"]) == 1
            entry = snapshot["history"][0]
            assert entry["type"] == "deck_draw"
            assert entry["player"] == "Ana"
            assert entry["remaining"] == 50


def test_spectator_cannot_operate_deck(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=Ana&spectator=1") as ws:
        next_event(ws)  # snapshot (historico vazio pra espectador)
        ws.send_json(DRAW_MESSAGE)
        error = next_event(ws)
        assert error == {"type": "error", "message": "spectator_cannot_roll"}


def test_deck_draw_rejects_empty_cards_and_out_of_range_remaining(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws:
        next_event(ws)  # snapshot

        ws.send_json({**DRAW_MESSAGE, "cards": []})
        assert next_event(ws)["type"] == "error"

        ws.send_json({**DRAW_MESSAGE, "remaining": 999})
        assert next_event(ws)["type"] == "error"

        ws.send_json({**DRAW_MESSAGE, "cards": [{"id": "x", "suit": "invalid", "rank": "A"}]})
        assert next_event(ws)["type"] == "error"


def test_deck_config_rejects_unknown_field(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws:
        next_event(ws)  # snapshot
        ws.send_json(
            {
                "type": "deck_config",
                "not_a_real_field": True,
                "timestamp": "2026-01-01T00:00:00Z",
            }
        )
        assert next_event(ws)["type"] == "error"
