# Contratos Pydantic do backend.
#
# RollGroup/RollResult espelham o contrato de docs/roll-notation.md (inclui
# `outcome_flags`, adicionado ao rules-engine na etapa 01) — toda mensagem
# recebida via WS e validada contra esses modelos, nunca dict cru.
# CustomProfile e filhos espelham o schema de docs/system-profiles.md — o
# backend valida estrutura antes de persistir, sem avaliar `condition`
# (isso e do rules-engine TS).
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class RollGroup(BaseModel):
    rolls: list[int]
    modifier: int | None = None
    total: int | None = None


class RollResult(BaseModel):
    notation: str
    groups: dict[str, RollGroup]
    profile: str | None = None
    outcome: str | None = None
    outcome_flags: list[str] | None = None
    timestamp: str


# --- protocolo WS (ver docstring de app/rooms.py) ---


class RollEventIn(BaseModel):
    """Envelope client -> server para um evento de rolagem."""

    type: Literal["roll"]
    result: RollResult


HEX_COLOR = r"^#[0-9a-fA-F]{6}$"


class DiceStyle(BaseModel):
    """Aparencia dos dados de um jogador. O backend nao interpreta nada disso
    — so guarda e retransmite pra mesa inteira ver o dado de quem rolou com a
    cor de quem rolou. Validado mesmo assim: o valor vai parar no renderer
    dos OUTROS clientes (docs/security.md — nunca aceitar payload cru)."""

    model_config = ConfigDict(extra="forbid")

    body: str = Field(pattern=HEX_COLOR)
    number: str = Field(pattern=HEX_COLOR)
    outline: str = Field(pattern=HEX_COLOR)
    texture: str = Field(max_length=32, pattern=r"^[a-z0-9_]+$")
    material: str = Field(max_length=16, pattern=r"^[a-z]+$")


class RosterMember(BaseModel):
    """Quem esta na sala, com a aparencia dos dados dessa pessoa."""

    name: str
    style: DiceStyle | None = None


class HistoryEntry(BaseModel):
    """Entrada do historico da sala: quem rolou, o resultado e a aparencia
    dos dados de quem rolou (pra reproduzir a cor certa no replay)."""

    player: str
    result: RollResult
    style: DiceStyle | None = None


# --- profiles custom (docs/system-profiles.md) ---


# Tetos de tamanho: profile custom fica gravado pra sempre no Postgres, e o
# schema sem limite aceita string de megabytes (docs/security.md).
class ProfileInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(max_length=32)
    label: str = Field(max_length=80)
    type: Literal["number", "select"]
    options: list[str] | None = Field(default=None, max_length=32)


class ProfileField(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(max_length=32)
    dice: str = Field(max_length=160)
    modifier: str | None = Field(default=None, max_length=160)
    compare_individually: bool = False


class OutcomeRule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    condition: str = Field(max_length=400)
    result: str = Field(max_length=64)


class CustomProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    system: str = Field(max_length=64)
    label: str = Field(max_length=120)
    roll_type: Literal["simple", "comparison"]
    inputs: list[ProfileInput] = Field(default_factory=list, max_length=24)
    fields: list[ProfileField] = Field(min_length=1, max_length=8)
    outcome_rules: list[OutcomeRule] = Field(default_factory=list, max_length=64)


class StoredProfile(BaseModel):
    id: str
    profile: CustomProfile


class RoomCreated(BaseModel):
    code: str
    ttl_seconds: int


# Mensagens server -> client nao passam por validacao de entrada, mas ficam
# documentadas aqui como referencia do protocolo:
#   {"type": "snapshot", "roster": [RosterMember], "history": [HistoryEntry]}
#   {"type": "roll", "player": str, "result": RollResult, "style": DiceStyle?}
#       (broadcast, inclui remetente)
#   {"type": "roster", "roster": [RosterMember]}   (entrada/saida de jogador)
#   {"type": "error", "message": str}
ServerMessage = dict[str, Any]
