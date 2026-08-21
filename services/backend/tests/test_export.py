# Export do historico da sala nos 3 formatos (json/csv/md).
from starlette.testclient import TestClient

from tests.conftest import make_roll_message


def _room_with_history(client: TestClient) -> str:
    code: str = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws:
        ws.receive_json()  # snapshot
        ws.send_json(make_roll_message(notation="2d6", total=6))
        ws.receive_json()  # echo
        ws.send_json(
            {
                "type": "roll",
                "result": {
                    "notation": "ironsworn attribute=2",
                    "groups": {
                        "action": {"rolls": [4], "modifier": 2, "total": 6},
                        "challenge": {"rolls": [7, 3]},
                    },
                    "profile": "ironsworn",
                    "outcome": "weak_hit",
                    "outcome_flags": ["weak_hit"],
                    "timestamp": "2026-01-01T00:01:00Z",
                },
            }
        )
        ws.receive_json()  # echo
        ws.send_json(
            {
                "type": "deck_draw",
                "cards": [{"id": "hearts-A", "suit": "hearts", "rank": "A"}],
                "remaining": 51,
                "timestamp": "2026-01-01T00:02:00Z",
            }
        )
        ws.receive_json()  # echo
    return code


def test_export_json(client: TestClient) -> None:
    code = _room_with_history(client)
    resp = client.get(f"/rooms/{code}/export?format=json")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["room"] == code
    assert len(payload["history"]) == 3
    assert payload["history"][1]["result"]["outcome_flags"] == ["weak_hit"]
    assert payload["history"][2]["type"] == "deck_draw"
    assert payload["history"][2]["remaining"] == 51


def test_export_csv(client: TestClient) -> None:
    code = _room_with_history(client)
    resp = client.get(f"/rooms/{code}/export?format=csv")
    assert resp.status_code == 200
    lines = resp.text.strip().splitlines()
    assert lines[0] == (
        "received_at,timestamp,player,type,notation,profile,outcome,outcome_flags,detail"
    )
    assert len(lines) == 4
    assert "Ana" in lines[1] and "2d6" in lines[1]
    assert "ironsworn" in lines[2] and "weak_hit" in lines[2]
    assert "deck_draw" in lines[3] and "restam 51" in lines[3]


def test_export_markdown(client: TestClient) -> None:
    code = _room_with_history(client)
    resp = client.get(f"/rooms/{code}/export?format=md")
    assert resp.status_code == 200
    assert resp.text.startswith(f"# Sala {code}")
    assert "| timestamp | player | type | notation |" in resp.text
    assert "ironsworn" in resp.text
    assert "deck_draw" in resp.text


def test_export_unknown_room_is_404(client: TestClient) -> None:
    assert client.get("/rooms/inexistente/export").status_code == 404


def test_export_invalid_format_is_422(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    assert client.get(f"/rooms/{code}/export?format=xml").status_code == 422
