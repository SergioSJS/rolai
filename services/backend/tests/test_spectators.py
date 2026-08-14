# Espectadores (modo stream/OBS, query param spectator=1): nao entram no
# roster, nao contam no teto de membros, nunca rolam — so recebem os
# broadcasts de rolagem dos jogadores. Ver docs/handoff.md ("modo stream").
from collections.abc import Callable
from typing import Any

from starlette.testclient import TestClient, WebSocketTestSession

from tests.conftest import assert_ws_rejected, make_roll_message


def next_event(ws: WebSocketTestSession, skip_roster: bool = True) -> dict[str, Any]:
    """Proxima mensagem, pulando os avisos de roster."""
    while True:
        message: dict[str, Any] = ws.receive_json()
        if skip_roster and message["type"] == "roster":
            continue
        return message


def test_spectator_does_not_count_toward_member_cap(
    make_client: Callable[..., TestClient],
) -> None:
    with make_client(max_members_per_room=1) as client:
        code = client.post("/rooms").json()["code"]
        with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws_a:
            next_event(ws_a)  # snapshot
            # Sala "cheia" pra jogadores, mas espectador entra mesmo assim.
            with client.websocket_connect(f"/rooms/{code}?spectator=1") as ws_s:
                assert next_event(ws_s)["type"] == "snapshot"
            # Segundo JOGADOR continua barrado.
            assert_ws_rejected(client, f"/rooms/{code}?name=Beto", 4429)


def test_spectator_cap_is_separate(make_client: Callable[..., TestClient]) -> None:
    with make_client(max_spectators_per_room=1) as client:
        code = client.post("/rooms").json()["code"]
        with client.websocket_connect(f"/rooms/{code}?spectator=1") as ws_s:
            next_event(ws_s)
            assert_ws_rejected(client, f"/rooms/{code}?spectator=1", 4429)


def test_spectator_never_appears_in_roster(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws_a:
        next_event(ws_a, skip_roster=False)  # snapshot
        assert ws_a.receive_json()["type"] == "roster"  # aviso da propria entrada

        with client.websocket_connect(f"/rooms/{code}?spectator=1") as ws_s:
            # Snapshot do espectador: ve os jogadores, mas nao a si mesmo.
            snapshot = next_event(ws_s)
            assert [m["name"] for m in snapshot["roster"]] == ["Ana"]

        # Nem a entrada nem a saida do espectador geram aviso de roster pra
        # sala — se gerasse, o receive abaixo levantaria timeout.
        ws_a.send_json(make_roll_message())
        assert next_event(ws_a, skip_roster=False)["type"] == "roll"


def test_spectator_roll_is_rejected_and_not_broadcast(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with (
        client.websocket_connect(f"/rooms/{code}?name=Ana") as ws_a,
        client.websocket_connect(f"/rooms/{code}?spectator=1") as ws_s,
    ):
        next_event(ws_a)  # snapshot
        next_event(ws_s)  # snapshot

        ws_s.send_json(make_roll_message())
        assert next_event(ws_s) == {"type": "error", "message": "spectator_cannot_roll"}

        # Nada foi pro broadcast nem pro historico: quem entra depois ve o
        # historico vazio.
        with client.websocket_connect(f"/rooms/{code}?name=Beto") as ws_b:
            snapshot = next_event(ws_b)
            assert snapshot["history"] == []
        # Conexao do espectador segue viva depois do erro.
        ws_a.send_json(make_roll_message())
        assert next_event(ws_s)["type"] == "roll"


def test_spectator_receives_roll_broadcasts(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with (
        client.websocket_connect(f"/rooms/{code}?name=Ana") as ws_a,
        client.websocket_connect(f"/rooms/{code}?spectator=1") as ws_s,
    ):
        next_event(ws_a)
        next_event(ws_s)
        ws_a.send_json(make_roll_message(notation="1d20", total=17))
        event = next_event(ws_s)
        assert event["type"] == "roll"
        assert event["player"] == "Ana"
        assert event["result"]["notation"] == "1d20"


def test_player_keeps_broadcasting_after_spectator_dict_gets_recycled(
    client: TestClient,
) -> None:
    # Bug ao vivo (Browser Source do OBS parava de receber depois de um F5):
    # o jogador guarda o dict de espectadores da sala UMA VEZ, no momento em
    # que entra, e fica preso no loop de mensagens a sessao inteira. Se os
    # espectadores zerarem em algum momento (o primeiro sai), o dict e
    # apagado de app.state; o PROXIMO espectador a entrar ganha um dict
    # NOVO. O jogador (que nunca reconectou) nao tem como saber e continua
    # fazendo broadcast pro dict orfao de sempre — o espectador novo nunca
    # recebe rolagem nenhuma, sem erro em lugar nenhum.
    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws_a:
        next_event(ws_a)  # snapshot

        # Primeiro espectador entra e sai — zera o dict, que sai de
        # app.state (rooms.py: `if not spectators: ...pop(code, None)`).
        with client.websocket_connect(f"/rooms/{code}?spectator=1") as ws_s1:
            next_event(ws_s1)

        # Segundo espectador entra DEPOIS que o primeiro ja saiu: ganha um
        # dict novo em app.state.
        with client.websocket_connect(f"/rooms/{code}?spectator=1") as ws_s2:
            next_event(ws_s2)

            # Ana nunca reconectou — ainda assim a rolagem dela tem que
            # chegar no espectador novo.
            ws_a.send_json(make_roll_message(notation="1d20", total=9))
            next_event(ws_a)  # echo
            event = next_event(ws_s2)
            assert event["type"] == "roll"
            assert event["result"]["notation"] == "1d20"


def test_spectator_snapshot_has_no_history(client: TestClient) -> None:
    code = client.post("/rooms").json()["code"]
    with client.websocket_connect(f"/rooms/{code}?name=Ana") as ws_a:
        next_event(ws_a)
        ws_a.send_json(make_roll_message())
        next_event(ws_a)  # echo

        with client.websocket_connect(f"/rooms/{code}?spectator=1") as ws_s:
            snapshot = next_event(ws_s)
            assert snapshot["type"] == "snapshot"
            assert snapshot["history"] == []

        # Jogador que entra depois continua recebendo o historico normal.
        with client.websocket_connect(f"/rooms/{code}?name=Beto") as ws_b:
            assert len(next_event(ws_b)["history"]) == 1
