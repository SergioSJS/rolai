# Estado da sala no Redis (spec 02-backend-relay.md). Nenhuma rota aqui:
# so leitura/escrita e os tetos de capacidade.
#
# TTL renovado a cada evento (entrada, saida, rolagem):
#   room:{code}          string "1"  — marcador de existencia da sala
#   room:{code}:roster   hash member_id -> nome
#   room:{code}:history  list de HistoryEntry serializado (capado em
#                        settings.history_max_entries)
#   rooms:active         set com o codigo de cada sala viva — teto global de
#                        salas (settings.max_active_rooms), prunado a cada
#                        criacao (sala expirada some do set)
import secrets

from pydantic import TypeAdapter
from redis.asyncio import Redis

from app.config import Settings
from app.schemas import DiceStyle, HistoryEntry, RosterMember

MAX_CODE_RETRIES = 10

ACTIVE_ROOMS_KEY = "rooms:active"

_HISTORY_ENTRY_ADAPTER: TypeAdapter[HistoryEntry] = TypeAdapter(HistoryEntry)


class RoomCapReached(Exception):
    """Teto global de salas ativas (settings.max_active_rooms) atingido."""


def generate_room_code(length_bytes: int = 6) -> str:
    """Codigo de sala via CSPRNG — nunca sequencial (docs/security.md)."""
    return secrets.token_urlsafe(length_bytes)


class RoomStore:
    """Operacoes de estado da sala em cima do Redis. Relay burro: guarda e
    devolve payloads ja validados, sem recalcular nada."""

    def __init__(self, redis: Redis, settings: Settings) -> None:
        self._redis = redis
        self._settings = settings

    def _key(self, code: str, suffix: str = "") -> str:
        return f"room:{code}{suffix}"

    async def claim(self, code: str) -> bool:
        """Cria a sala COM o codigo pedido. False = o codigo ja existia.

        NX: se duas pessoas abrirem o mesmo link ao mesmo tempo, a primeira
        cria e a segunda entra na sala da primeira — nunca duas salas com o
        mesmo codigo, nunca uma sobrescrevendo a outra.
        """
        await self._enforce_room_cap()
        if not await self._redis.set(self._key(code), "1", nx=True):
            return False
        await self._redis.sadd(ACTIVE_ROOMS_KEY, code)
        await self._refresh_ttl(code)
        return True

    async def create(self) -> str:
        await self._enforce_room_cap()
        for _ in range(MAX_CODE_RETRIES):
            code = generate_room_code()
            # NX: colisao (astronomicamente improvavel) tenta outro codigo.
            if await self._redis.set(self._key(code), "1", nx=True):
                await self._redis.sadd(ACTIVE_ROOMS_KEY, code)
                await self._refresh_ttl(code)
                return code
        raise RuntimeError("falha ao gerar codigo de sala unico")

    async def _enforce_room_cap(self) -> None:
        """Teto GLOBAL de salas ativas (docs/security.md): o limite por IP
        barra um bot, mas N bots com N IPs ainda enchem o Redis. 0 desliga."""
        limit = self._settings.max_active_rooms
        if limit <= 0:
            return
        await self._prune_active_rooms()
        if await self._redis.scard(ACTIVE_ROOMS_KEY) >= limit:
            raise RoomCapReached

    async def _prune_active_rooms(self) -> None:
        """O set nao tem TTL por membro: sala cuja chave marcador expirou sai
        do set aqui, senao o teto global contaria sala morta. Salas sao
        poucas — um EXISTS por membro (pipeline) e irrelevante de custo."""
        # decode_responses=True em todo cliente Redis da app: os stubs do
        # redis-py declaram bytes|str, mas em runtime e sempre str.
        members = {str(code) for code in await self._redis.smembers(ACTIVE_ROOMS_KEY)}
        if not members:
            return
        pipe = self._redis.pipeline(transaction=False)
        for code in members:
            pipe.exists(self._key(code))
        exists_flags = await pipe.execute()
        expired = [code for code, exists in zip(members, exists_flags, strict=True) if not exists]
        if expired:
            await self._redis.srem(ACTIVE_ROOMS_KEY, *expired)

    async def exists(self, code: str) -> bool:
        return bool(await self._redis.exists(self._key(code)))

    async def _refresh_ttl(self, code: str) -> None:
        ttl = self._settings.room_ttl_seconds
        for suffix in ("", ":roster", ":history"):
            await self._redis.expire(self._key(code, suffix), ttl)

    async def add_member(
        self,
        code: str,
        member_id: str,
        name: str,
        style: DiceStyle | None = None,
        styles: dict[str, DiceStyle] | None = None,
    ) -> None:
        member = RosterMember(name=name, style=style, styles=styles)
        await self._redis.hset(self._key(code, ":roster"), member_id, member.model_dump_json())
        await self._refresh_ttl(code)

    async def remove_member(self, code: str, member_id: str) -> None:
        await self._redis.hdel(self._key(code, ":roster"), member_id)
        await self._refresh_ttl(code)

    async def roster(self, code: str) -> list[RosterMember]:
        values = await self._redis.hvals(self._key(code, ":roster"))
        members = [RosterMember.model_validate_json(v) for v in values]
        return sorted(members, key=lambda m: m.name)

    async def append_history(self, code: str, entry: HistoryEntry) -> None:
        key = self._key(code, ":history")
        await self._redis.rpush(key, entry.model_dump_json())
        await self._redis.ltrim(key, -self._settings.history_max_entries, -1)
        await self._refresh_ttl(code)

    async def history(self, code: str) -> list[HistoryEntry]:
        raw = await self._redis.lrange(self._key(code, ":history"), 0, -1)
        return [_HISTORY_ENTRY_ADAPTER.validate_json(item) for item in raw]
