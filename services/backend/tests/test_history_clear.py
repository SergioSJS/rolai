# Limpar/ocultar historico (specs/09-limpar-historico.md): carimbo do
# servidor, corte no export e o evento history_clear.
import json
from collections.abc import Callable

import pytest
from fakeredis.aioredis import FakeRedis
from starlette.testclient import TestClient

from tests.conftest import make_roll_message
from tests.test_rooms import next_event


def _room_with_two_rolls(client: TestClient) -> tuple[str, str]:
    """Cria sala com duas rolagens; devolve (codigo, received_at da primeira)."""
    code: str = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws:
        next_event(ws)  # snapshot
        ws.send_json(make_roll_message(notation="1d20", total=11))
        primeira = next_event(ws)
        ws.send_json(make_roll_message(notation="2d6", total=7))
        next_event(ws)
    return code, str(primeira["received_at"])


def test_broadcast_carrega_received_at(client: TestClient) -> None:
    """Sem isso o cliente so veria o carimbo no proximo snapshot, e o corte
    do "ocultar" nao pegaria nada do que chegou ao vivo."""
    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws:
        next_event(ws)  # snapshot
        ws.send_json(make_roll_message())
        event = next_event(ws)
    assert event["type"] == "roll"
    assert isinstance(event["received_at"], str) and event["received_at"]
    # Convive com o timestamp do cliente, nao substitui: um e quando rolou no
    # aparelho, o outro e quando o relay recebeu.
    assert event["result"]["timestamp"] == "2026-01-01T00:00:00Z"


def test_historico_guardado_tem_received_at_crescente(client: TestClient) -> None:
    code, _ = _room_with_two_rolls(client)
    with client.websocket_connect(f"/rooms/{code}?name=Bia") as ws:
        snapshot = next_event(ws)
    carimbos = [e["received_at"] for e in snapshot["history"]]
    assert len(carimbos) == 2
    assert all(isinstance(c, str) for c in carimbos)
    # Ordem da lista == ordem dos carimbos: e o que permite comparar `> corte`.
    assert carimbos == sorted(carimbos)


@pytest.mark.anyio
async def test_entrada_legada_sem_received_at_nao_quebra_snapshot(
    make_client: Callable[..., TestClient], redis_client: FakeRedis
) -> None:
    """Sala viva no Redis tem entrada gravada antes do campo existir. Se
    `received_at` fosse obrigatorio, validate_json levantaria dentro de
    RoomStore.history() e o deploy derrubaria a mesa em andamento."""
    with make_client() as client:
        code = client.post("/rooms").json()["code"]
        legada = {
            "type": "roll",
            "player": "Ana",
            "result": {
                "notation": "1d20",
                "groups": {"1d20": {"rolls": [11], "total": 11}},
                "timestamp": "2026-01-01T00:00:00Z",
            },
        }
        await redis_client.rpush(f"room:{code}:history", json.dumps(legada))
        with client.websocket_connect(f"/rooms/{code}?name=Bia") as ws:
            snapshot = next_event(ws)
        assert len(snapshot["history"]) == 1
        # Snapshot serializa com exclude_none: o campo simplesmente nao vem,
        # e o cliente cai no timestamp do payload pra decidir o corte.
        assert "received_at" not in snapshot["history"][0]


def test_history_clear_apaga_pra_todo_mundo(client: TestClient) -> None:
    code, _ = _room_with_two_rolls(client)
    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws_a:
        assert len(next_event(ws_a)["history"]) == 2
        with client.websocket_connect(f"/rooms/{code}?name=Bia") as ws_b:
            next_event(ws_b)  # snapshot

            ws_b.send_json({"type": "history_clear"})
            for ws in (ws_a, ws_b):
                evento = next_event(ws)
                assert evento["type"] == "history_cleared"
                assert evento["player"] == "Bia"
                assert isinstance(evento["received_at"], str)

    # Quem entrar depois recebe snapshot vazio — o "limpar" e da mesa, nao da aba.
    with client.websocket_connect(f"/rooms/{code}?name=Cau") as ws_c:
        assert next_event(ws_c)["history"] == []


def test_history_clear_mantem_a_sala_viva(client: TestClient) -> None:
    code, _ = _room_with_two_rolls(client)
    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws:
        next_event(ws)
        ws.send_json({"type": "history_clear"})
        next_event(ws)
        # Sala continua existindo: da pra rolar de novo e o log recomeca.
        ws.send_json(make_roll_message(notation="1d4", total=3))
        assert next_event(ws)["type"] == "roll"
    assert client.get(f"/rooms/{code}/export").status_code == 200


def test_espectador_nao_limpa_historico(client: TestClient) -> None:
    code, _ = _room_with_two_rolls(client)
    with client.websocket_connect(f"/rooms/{code}?name=OBS&spectator=1") as ws:
        next_event(ws)  # snapshot
        ws.send_json({"type": "history_clear"})
        erro = next_event(ws)
        assert erro["type"] == "error"
        assert erro["message"] == "spectator_cannot_roll"
    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws_a:
        assert len(next_event(ws_a)["history"]) == 2


def test_export_respeita_o_corte(client: TestClient) -> None:
    """Sem isso o link de export entrega justamente o que foi ocultado."""
    code, corte = _room_with_two_rolls(client)
    completo = client.get(f"/rooms/{code}/export").json()
    assert len(completo["history"]) == 2

    cortado = client.get(f"/rooms/{code}/export", params={"since": corte}).json()
    assert len(cortado["history"]) == 1
    assert cortado["history"][0]["result"]["notation"] == "2d6"

    csv_cortado = client.get(
        f"/rooms/{code}/export", params={"format": "csv", "since": corte}
    ).text
    assert "1d20" not in csv_cortado
    assert "2d6" in csv_cortado


def test_export_sem_corte_traz_tudo(client: TestClient) -> None:
    code, _ = _room_with_two_rolls(client)
    for params in ({}, {"since": ""}):
        payload = client.get(f"/rooms/{code}/export", params=params).json()
        assert len(payload["history"]) == 2
