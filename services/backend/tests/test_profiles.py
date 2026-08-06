# CRUD de profiles custom: valido persiste e recupera; invalido -> 422.
from starlette.testclient import TestClient

from app.schemas import CustomProfile

VALID_PROFILE = {
    "system": "meu-sistema",
    "label": "Meu Sistema — Rolagem",
    "roll_type": "simple",
    "inputs": [{"id": "mod", "label": "Modificador", "type": "number"}],
    "fields": [{"id": "roll", "dice": "2d6", "modifier": "{input.mod}"}],
    "outcome_rules": [
        {"condition": "roll.total >= 10", "result": "strong_hit"},
        {"condition": "roll.total < 10", "result": "miss"},
    ],
}


def test_post_valid_profile_persists_and_gets_back(client: TestClient) -> None:
    resp = client.post("/profiles", json=VALID_PROFILE)
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"]
    expected = CustomProfile.model_validate(VALID_PROFILE)
    assert CustomProfile.model_validate(body["profile"]) == expected

    got = client.get(f"/profiles/{body['id']}")
    assert got.status_code == 200
    assert CustomProfile.model_validate(got.json()["profile"]) == expected


def test_post_invalid_profile_rejected_with_422(client: TestClient) -> None:
    # falta outcome_rules/fields/etc: so um dict arbitrario
    assert client.post("/profiles", json={"system": "x", "evil": "yaml"}).status_code == 422

    # roll_type fora do enum
    bad_roll_type = {**VALID_PROFILE, "roll_type": "complex"}
    assert client.post("/profiles", json=bad_roll_type).status_code == 422

    # input type fora do enum
    bad_input = {
        **VALID_PROFILE,
        "inputs": [{"id": "x", "label": "X", "type": "textarea"}],
    }
    assert client.post("/profiles", json=bad_input).status_code == 422

    # campo extra nao permitido (nunca aceitar dict arbitrario)
    extra = {**VALID_PROFILE, "on_save": "rm -rf /"}
    assert client.post("/profiles", json=extra).status_code == 422

    # fields vazio
    no_fields = {**VALID_PROFILE, "fields": []}
    assert client.post("/profiles", json=no_fields).status_code == 422


def test_get_unknown_profile_is_404(client: TestClient) -> None:
    assert client.get("/profiles/nao-existe").status_code == 404
