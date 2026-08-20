# Smoke test fim-a-fim contra o backend em localhost:8420 (scripts/dev_local.py).
# Cria sala via REST, conecta 2 clientes WS, rola em um e confere o broadcast
# no outro + snapshot de quem entra depois. Nao e commitado em tests/ porque
# precisa do servidor de pé — ferramenta de validacao manual.
import asyncio
import json
import urllib.request
from typing import Any

import websockets


def _get(url: str) -> str:
    with urllib.request.urlopen(url) as resp:
        return str(resp.read().decode())


async def recv_tipo(ws: Any, tipo: str, timeout: float = 5) -> dict[str, Any]:
    """Proxima mensagem DO TIPO pedido, pulando o que vier no meio.

    O roster e retransmitido pra sala inteira a cada entrada/saida, e o
    heartbeat manda {"type":"ping"} — os dois caem na fila antes do evento
    que o teste espera. Sem este filtro o smoke acusava "esperava roll, veio
    roster", que parece bug do relay e nao e.
    """
    while True:
        msg: dict[str, Any] = json.loads(await asyncio.wait_for(ws.recv(), timeout=timeout))
        if msg.get("type") == "ping":
            await ws.send('{"type":"pong"}')
            continue
        if msg.get("type") == tipo:
            return msg


def nomes(roster: list[dict[str, Any]]) -> set[str]:
    """Roster e lista de objetos ({name, style}) desde que o dado ganhou cor."""
    return {m["name"] for m in roster}


def create_room() -> str:
    req = urllib.request.Request("http://localhost:8420/rooms", method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())["code"]  # type: ignore[no-any-return]


async def main() -> None:
    code = create_room()
    url = f"ws://localhost:8420/rooms/{code}"

    async with websockets.connect(f"{url}?name=alice") as ws_a:
        snapshot_a = json.loads(await ws_a.recv())
        assert snapshot_a["type"] == "snapshot", snapshot_a
        assert nomes(snapshot_a["roster"]) == {"alice"}, snapshot_a

        async with websockets.connect(f"{url}?name=bob") as ws_b:
            snapshot_b = json.loads(await ws_b.recv())
            assert nomes(snapshot_b["roster"]) == {"alice", "bob"}, snapshot_b

            roll = {
                "type": "roll",
                "result": {
                    "notation": "2d6+3",
                    "groups": {"roll": {"rolls": [2, 4], "modifier": 3, "total": 9}},
                    "timestamp": "2026-08-05T12:00:00Z",
                },
            }
            await ws_a.send(json.dumps(roll))

            # bob recebe o broadcast do roll da alice
            broadcast = await recv_tipo(ws_b, "roll")
            assert broadcast["player"] == "alice", broadcast
            assert broadcast["result"]["groups"]["roll"]["total"] == 9, broadcast

            # alice recebe o proprio echo (ack)
            echo = await recv_tipo(ws_a, "roll")
            assert echo["player"] == "alice", echo

            # payload malformado: erro claro, conexao continua viva
            await ws_b.send(json.dumps({"type": "roll", "result": {"nope": True}}))
            err = await recv_tipo(ws_b, "error")
            assert err["message"], err

        # quem entra depois recebe o historico no snapshot
        async with websockets.connect(f"{url}?name=carol") as ws_c:
            snapshot_c = json.loads(await ws_c.recv())
            assert len(snapshot_c["history"]) == 1, snapshot_c
            assert snapshot_c["history"][0]["result"]["notation"] == "2d6+3", snapshot_c

    # export em markdown (urllib e bloqueante: sai da thread do event loop)
    body = await asyncio.to_thread(_get, f"http://localhost:8420/rooms/{code}/export?format=md")
    assert "2d6+3" in body, body

    print("SMOKE OK — sala", code)


asyncio.run(main())
