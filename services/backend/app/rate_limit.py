# Token bucket simples em memoria, por conexao WS (ver docs/security.md).
import time
from collections.abc import Callable


class TokenBucket:
    """Token bucket: `capacity` fichas, recarregando `rate_per_second` fichas/seg.

    Cada mensagem recebida consome uma ficha. Instancia por websocket —
    estado em memoria, nao compartilhado entre conexoes.
    """

    def __init__(
        self,
        rate_per_second: float,
        capacity: float,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if rate_per_second <= 0 or capacity <= 0:
            raise ValueError("rate_per_second e capacity devem ser positivos")
        self._rate = rate_per_second
        self._capacity = capacity
        self._tokens = capacity
        self._last = clock()
        self._clock = clock

    def allow(self) -> bool:
        """Consome uma ficha se houver; retorna False quando o limite estourou."""
        now = self._clock()
        self._tokens = min(self._capacity, self._tokens + (now - self._last) * self._rate)
        self._last = now
        if self._tokens >= 1.0:
            self._tokens -= 1.0
            return True
        return False
