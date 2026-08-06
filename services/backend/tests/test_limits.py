# Limites de abuso (docs/security.md — "Abuso e recursos"): teto por IP na
# criacao de sala e de profile, teto geral HTTP, corpo grande, conexoes WS
# por IP, gente por sala, apelido e codigo de sala fora do formato.
from collections.abc import Callable

import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from tests.test_rooms import next_event

PROFILE = {
    "system": "custom",
    "label": "Custom",
    "roll_type": "simple",
    "fields": [{"id": "roll", "dice": "2d6"}],
    "outcome_rules": [{"condition": "roll.total >= 7", "result": "hit"}],
}


def test_room_creation_is_capped_per_ip(make_client: Callable[..., TestClient]) -> None:
    """O cenario 'bot gera milhoes de salas': cada sala e uma chave no Redis
    com TTL de horas."""
    with make_client(room_create_limit_per_hour=3) as client:
        for _ in range(3):
            assert client.post("/rooms").status_code == 201
        blocked = client.post("/rooms")
        assert blocked.status_code == 429
        assert blocked.headers["Retry-After"] == "3600"


def test_generic_http_limit_per_ip(make_client: Callable[..., TestClient]) -> None:
    with make_client(http_rate_limit_per_minute=5) as client:
        for _ in range(5):
            assert client.get("/rooms/inexistente/export").status_code in (404, 200)
        assert client.get("/rooms/inexistente/export").status_code == 429


def test_health_is_not_rate_limited(make_client: Callable[..., TestClient]) -> None:
    """Monitoramento nao pode ser barrado junto com o resto."""
    with make_client(http_rate_limit_per_minute=2) as client:
        for _ in range(10):
            assert client.get("/health").status_code == 200


def test_profile_creation_is_capped_per_ip(make_client: Callable[..., TestClient]) -> None:
    with make_client(profile_create_limit_per_hour=2) as client:
        for _ in range(2):
            assert client.post("/profiles", json=PROFILE).status_code == 201
        assert client.post("/profiles", json=PROFILE).status_code == 429


def test_oversized_body_is_rejected_before_the_route(client: TestClient) -> None:
    huge = {**PROFILE, "label": "x" * 200_000}
    assert client.post("/profiles", json=huge).status_code == 413


def test_profile_schema_caps_field_sizes(client: TestClient) -> None:
    """Corpo dentro do limite, mas campo absurdo: barra no schema."""
    fat = {**PROFILE, "label": "x" * 5_000}
    assert client.post("/profiles", json=fat).status_code == 422


def test_ws_connections_capped_per_ip(make_client: Callable[..., TestClient]) -> None:
    with make_client(ws_connect_limit_per_minute=2) as client:
        code = client.post("/rooms").json()["code"]
        with client.websocket_connect(f"/rooms/{code}") as ws_a:
            next_event(ws_a)
            with client.websocket_connect(f"/rooms/{code}") as ws_b:
                next_event(ws_b)
                with (
                    pytest.raises(WebSocketDisconnect) as exc_info,
                    client.websocket_connect(f"/rooms/{code}"),
                ):
                    pass
                assert exc_info.value.code == 4429


def test_room_membership_is_capped(make_client: Callable[..., TestClient]) -> None:
    """Broadcast e N-para-N: sala lotada vira amplificacao de trafego."""
    with make_client(max_members_per_room=2) as client:
        code = client.post("/rooms").json()["code"]
        with (
            client.websocket_connect(f"/rooms/{code}?name=a") as ws_a,
            client.websocket_connect(f"/rooms/{code}?name=b") as ws_b,
        ):
            next_event(ws_a)
            next_event(ws_b)
            with (
                pytest.raises(WebSocketDisconnect) as exc_info,
                client.websocket_connect(f"/rooms/{code}?name=c"),
            ):
                pass
            assert exc_info.value.code == 4429


def test_long_nickname_is_truncated(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name={'x' * 5000}") as ws:
        snapshot = next_event(ws)
        assert len(snapshot["roster"][0]["name"]) == 24


def test_malformed_room_code_is_refused(client: TestClient) -> None:
    with (
        pytest.raises(WebSocketDisconnect) as exc_info,
        client.websocket_connect("/rooms/" + "x" * 500),
    ):
        pass
    assert exc_info.value.code == 4404


def test_ws_origin_must_be_allowed_when_present(
    make_client: Callable[..., TestClient],
) -> None:
    """CORS nao vale pra WebSocket: sem esta checagem, qualquer site abre
    conexao usando o navegador de quem visita."""
    with make_client(cors_origins=["https://rolai.app"]) as client:
        code = client.post("/rooms").json()["code"]
        with (
            pytest.raises(WebSocketDisconnect) as exc_info,
            client.websocket_connect(f"/rooms/{code}", headers={"origin": "https://evil.example"}),
        ):
            pass
        assert exc_info.value.code == 4403

        with client.websocket_connect(
            f"/rooms/{code}", headers={"origin": "https://rolai.app"}
        ) as ws:
            assert next_event(ws)["type"] == "snapshot"


def test_ws_without_origin_is_allowed(make_client: Callable[..., TestClient]) -> None:
    """Cliente nao-navegador (app Android) nao manda Origin."""
    with make_client(cors_origins=["https://rolai.app"]) as client:
        code = client.post("/rooms").json()["code"]
        with client.websocket_connect(f"/rooms/{code}") as ws:
            assert next_event(ws)["type"] == "snapshot"


def test_cf_connecting_ip_takes_precedence_over_x_forwarded_for(
    make_client: Callable[..., TestClient],
) -> None:
    """Atras da Cloudflare, o primeiro item do X-Forwarded-For continua
    forjavel (a CF ANEXA o IP real ao que o cliente mandou); CF-Connecting-IP
    e reescrito pela borda. O limite tem que contar no CF-Connecting-IP —
    docs/security-cloudflare.md."""
    with make_client(trust_proxy_headers=True, room_create_limit_per_hour=1) as client:
        first = client.post(
            "/rooms",
            headers={"CF-Connecting-IP": "203.0.113.7", "X-Forwarded-For": "192.0.2.1"},
        )
        assert first.status_code == 201
        # X-Forwarded-For DIFERENTE, mesmo CF-Connecting-IP: mesmo balde.
        second = client.post(
            "/rooms",
            headers={"CF-Connecting-IP": "203.0.113.7", "X-Forwarded-For": "192.0.2.99"},
        )
        assert second.status_code == 429


def test_x_forwarded_for_still_used_without_cf_header(
    make_client: Callable[..., TestClient],
) -> None:
    """Antes da laranja (ou sem Cloudflare no caminho) o comportamento de
    hoje se mantem: primeiro item do X-Forwarded-For."""
    with make_client(trust_proxy_headers=True, room_create_limit_per_hour=1) as client:
        assert (
            client.post("/rooms", headers={"X-Forwarded-For": "198.51.100.9"}).status_code == 201
        )
        assert (
            client.post("/rooms", headers={"X-Forwarded-For": "198.51.100.9"}).status_code == 429
        )
