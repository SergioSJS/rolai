# Cliente Redis async. A dependencia e injetada via app.state.redis para
# permitir fakeredis nos testes.
from redis.asyncio import Redis


def create_redis(url: str) -> Redis:
    return Redis.from_url(url, decode_responses=True)
