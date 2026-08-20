# Contratos Pydantic do backend.
#
# RollGroup/RollResult espelham o contrato de docs/roll-notation.md (inclui
# `outcome_flags`, adicionado ao rules-engine na etapa 01) — toda mensagem
# recebida via WS e validada contra esses modelos, nunca dict cru.
# CustomProfile e filhos espelham o schema de docs/system-profiles.md — o
# backend valida estrutura antes de persistir, sem avaliar `condition`
# (isso e do rules-engine TS).
# DeckCard e os eventos deck_* espelham @rolai/deck-engine (TS, ver
# packages/deck-engine/src/types.ts) — specs/08-baralho.md. Campo de wire
# em snake_case (mesma convencao do resto do protocolo: `outcome_flags`,
# `compare_individually`), o cliente TS traduz pra camelCase.
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class RollGroup(BaseModel):
    rolls: list[int]
    # Dados descartados pelo keep/drop ("4d6kh3", "1d20adv"): a UI mostra o
    # pool inteiro, com o descartado apagado. Sem este campo aqui, uma
    # rolagem com keep/drop feita por um cliente novo seria REJEITADA na
    # sala — o backend valida payload por modelo (docs/security.md).
    dropped: list[int] | None = None
    modifier: int | None = None
    total: int | None = None
    slot: int | None = None
    theme: str | None = None


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


class DeckCard(BaseModel):
    """Uma carta — espelha Card de @rolai/deck-engine."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(max_length=32)
    suit: Literal["hearts", "diamonds", "clubs", "spades", "joker"]
    rank: Literal["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "joker"]


class DeckDrawEventIn(BaseModel):
    """Envelope client -> server pra uma puxada de baralho. Baralho e local
    por jogador (specs/08-baralho.md) — o backend nao sabe se `remaining`
    bate com um monte de verdade, so valida a FORMA e retransmite pro
    historico da sala, igual a rolagem."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["deck_draw"]
    cards: list[DeckCard] = Field(min_length=1, max_length=54)
    remaining: int = Field(ge=0, le=54)
    timestamp: str


class DeckShuffleEventIn(BaseModel):
    """Envelope client -> server: jogador reembaralhou o proprio baralho."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["deck_shuffle"]
    timestamp: str


class DeckConfigEventIn(BaseModel):
    """Envelope client -> server: jogador mudou config do baralho (curinga,
    modo de remocao, reembaralhar automatico). Todo campo opcional — so o
    que mudou vai no evento."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["deck_config"]
    include_jokers: bool | None = None
    removal_mode: Literal["permanent", "returns"] | None = None
    auto_reshuffle_on_empty: bool | None = None
    timestamp: str


ClientEventIn = Annotated[
    RollEventIn | DeckDrawEventIn | DeckShuffleEventIn | DeckConfigEventIn,
    Field(discriminator="type"),
]


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


DiceStyles = dict[str, DiceStyle]


class RosterMember(BaseModel):
    """Quem esta na sala, com a aparencia dos dados dessa pessoa."""

    name: str
    style: DiceStyle | None = None
    styles: DiceStyles | None = None


class RollHistoryEntry(BaseModel):
    """Entrada do historico da sala: quem rolou, o resultado e a aparencia
    dos dados de quem rolou (pra reproduzir a cor certa no replay)."""

    type: Literal["roll"] = "roll"
    player: str
    result: RollResult
    style: DiceStyle | None = None
    styles: DiceStyles | None = None


class DeckDrawHistoryEntry(BaseModel):
    """Log de uma puxada de baralho — quem puxou, quais cartas, quantas
    ficaram (specs/08-baralho.md, "log de quem reembaralhar e operar")."""

    type: Literal["deck_draw"] = "deck_draw"
    player: str
    cards: list[DeckCard]
    remaining: int
    timestamp: str


class DeckShuffleHistoryEntry(BaseModel):
    """Log de um reembaralhar — so quem e quando; a composicao nao muda."""

    type: Literal["deck_shuffle"] = "deck_shuffle"
    player: str
    timestamp: str


class DeckConfigHistoryEntry(BaseModel):
    """Log de uma mudanca de config do baralho."""

    type: Literal["deck_config"] = "deck_config"
    player: str
    include_jokers: bool | None = None
    removal_mode: Literal["permanent", "returns"] | None = None
    auto_reshuffle_on_empty: bool | None = None
    timestamp: str


HistoryEntry = Annotated[
    RollHistoryEntry | DeckDrawHistoryEntry | DeckShuffleHistoryEntry | DeckConfigHistoryEntry,
    Field(discriminator="type"),
]


# --- profiles custom (docs/system-profiles.md) ---


# Tetos de tamanho: profile custom fica gravado pra sempre no Postgres, e o
# schema sem limite aceita string de megabytes (docs/security.md).
class ProfileInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(max_length=32)
    label: str = Field(max_length=80)
    type: Literal["number", "select"]
    # false = pode ficar em branco (rules-engine pula outcome_rules que o
    # referenciam). Default True preserva profiles gravados antes deste campo.
    required: bool = True
    # Hint de UI (pre-preenche o formulario, ex. "0" num modificador) — nao
    # afeta required/validacao, so aparencia. Ver rules-engine/profile.ts.
    default: str | None = Field(default=None, max_length=32)
    options: list[str] | None = Field(default=None, max_length=32)


class ProfileField(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(max_length=32)
    dice: str = Field(max_length=160)
    modifier: str | None = Field(default=None, max_length=160)
    compare_individually: bool = False
    # Minilinguagem do count() sem aspas (ex. ">=5"): `total` do grupo vira
    # a contagem de dados que batem, nao a soma. Ver rules-engine/profile.ts.
    success_rule: str | None = Field(default=None, max_length=16)


class OutcomeRule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    condition: str = Field(max_length=400)
    result: str = Field(max_length=64)


class CustomProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    system: str = Field(max_length=64)
    label: str = Field(max_length=120)
    roll_type: Literal["simple", "comparison", "multi", "overlay"]
    inputs: list[ProfileInput] = Field(default_factory=list, max_length=24)
    # min_length=0: roll_type "overlay" nao tem field proprio (a rolagem vem
    # de fora) — a contagem certa por roll_type e responsabilidade do
    # rules-engine (parseProfile), o backend so limita o TAMANHO da lista.
    fields: list[ProfileField] = Field(default_factory=list, max_length=8)
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
#   {"type": "deck_draw", "player": str, "cards": [DeckCard], "remaining": int, "timestamp": str}
#   {"type": "deck_shuffle", "player": str, "timestamp": str}
#   {"type": "deck_config", "player": str, "include_jokers": bool?,
#    "removal_mode": str?, "auto_reshuffle_on_empty": bool?, "timestamp": str}
#       (os tres deck_* acima: broadcast, inclui remetente, mesmo ack/echo da rolagem)
#   {"type": "roster", "roster": [RosterMember]}   (entrada/saida de jogador)
#   {"type": "error", "message": str}
ServerMessage = dict[str, Any]
