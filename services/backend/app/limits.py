# Limites de abuso por IP (docs/security.md — "Abuso e recursos").
#
# Janela fixa no Redis: INCR + EXPIRE na primeira ocorrencia da janela. E o
# suficiente pro que precisamos (barrar bot criando sala em loop, flood de
# conexao) e nao guarda estado em memoria — vale entre reinicios e entre
# instancias, ao contrario do token bucket por socket (rate_limit.py), que
# zera a cada reconexao.
from fastapi import Request, WebSocket
from redis.asyncio import Redis


def client_ip(source: Request | WebSocket, trust_proxy: bool) -> str:
    """IP do cliente. Atras do Traefik, o IP real vem em X-Forwarded-For —
    mas so da pra confiar nesse header quando existe mesmo um proxy na
    frente, senao qualquer um forja o header e escapa do limite. Por isso
    `trust_proxy` e opt-in por env (ver infra/docker-compose.hostinger.yml).

    Com a Cloudflare no caminho, preferir CF-Connecting-IP: a borda da CF
    SOBRESCREVE esse header a cada requisicao, enquanto no X-Forwarded-For
    ela so ANEXA o IP real ao que o cliente mandou (o primeiro item continua
    forjavel). Confianca valida nos dois so com o acesso direto ao VPS
    fechado (firewall nos ranges da CF ou ipAllowList no Traefik) — sem
    isso, quem pula a CF forja o header do mesmo jeito. Detalhes em
    docs/security-cloudflare.md.
    """
    if trust_proxy:
        cf = source.headers.get("cf-connecting-ip")
        if cf and cf.strip():
            return cf.strip()[:45]  # cabe um IPv6 completo
        forwarded = source.headers.get("x-forwarded-for")
        if forwarded:
            first = forwarded.split(",")[0].strip()
            if first:
                return first[:45]  # cabe um IPv6 completo
    client = source.client
    return client.host if client else "unknown"


async def within_limit(redis: Redis, key: str, limit: int, window_seconds: int) -> bool:
    """Consome uma unidade da janela. False = estourou o limite.

    `limit <= 0` desliga a checagem (util pra teste e pra deploy interno).
    """
    if limit <= 0:
        return True
    count = int(await redis.incr(key))
    if count == 1:
        await redis.expire(key, window_seconds)
    return count <= limit
