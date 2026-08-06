# Configuracao via variavel de ambiente.
# Ver .env.example na raiz do monorepo para as chaves esperadas.
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    redis_url: str = "redis://localhost:6379/0"
    postgres_dsn: str = "postgresql+asyncpg://rolai:rolai@localhost:5432/rolai"
    # Dev local: origem do `npm run dev` do apps/web. Em producao, sobrescrever
    # via env CORS_ORIGINS com o dominio do frontend — nunca "*" (docs/security.md).
    cors_origins: list[str] = ["http://localhost:5273"]
    room_ttl_seconds: int = 6 * 60 * 60
    rate_limit_per_minute: int = 60
    max_message_bytes: int = 4 * 1024  # docs/security.md: rejeitar antes de parsear
    history_max_entries: int = 200
    # Heartbeat do WS: sem mensagem do cliente por este intervalo, o servidor
    # envia {"type":"ping"} — proxy com timeout ocioso (Cloudflare ~100s)
    # nao derruba a conexao parada (docs/security-cloudflare.md). 0 desliga.
    ws_heartbeat_seconds: float = 30

    # --- limites de abuso (docs/security.md). 0 desliga o limite. ---
    # Confiar em X-Forwarded-For SO quando ha proxy na frente (Traefik);
    # sem proxy, o header e forjavel e o limite por IP vira decorativo.
    trust_proxy_headers: bool = False
    # Teto geral por IP pra qualquer rota HTTP (a UI faz pouquissimas
    # chamadas; isso e folgado pra uso normal e apertado pra bot).
    http_rate_limit_per_minute: int = 120
    # Criacao de sala e de profile sao as rotas que geram estado persistente.
    room_create_limit_per_hour: int = 30
    profile_create_limit_per_hour: int = 10
    # Abrir conexao WS tambem custa: limita o truque de reconectar pra zerar
    # o token bucket por socket.
    ws_connect_limit_per_minute: int = 30
    # Teto de gente na mesma sala: o broadcast e N-para-N, entao N grande
    # vira amplificacao de trafego.
    max_members_per_room: int = 20
    # Espectadores (modo stream/OBS: so recebem broadcast, nunca rolam e nao
    # entram no roster) tem teto proprio, separado do de jogadores.
    max_spectators_per_room: int = 5
    max_name_length: int = 24
    max_body_bytes: int = 64 * 1024

    # --- teto global e expurgo (docs/security.md — "Abuso e recursos"). ---
    # Teto GLOBAL de salas ativas: o limite por IP barra um bot, mas N bots
    # com N IPs ainda enchem o Redis. Acima do teto, POST /rooms devolve 503
    # ate alguma sala expirar. 0 desliga.
    max_active_rooms: int = 1000
    # GET /stats: vazio = endpoint aberto (so agregados). Com token, exige
    # Authorization: Bearer <token>.
    stats_token: str = ""
    # Profile custom e EFEMERO: task periodica no lifespan remove profiles com
    # mais de N dias. 0 desliga o expurgo (profile vive pra sempre).
    profile_ttl_days: int = 30
    # Intervalo da task de expurgo (default: diario). 0 desliga a task.
    profile_purge_interval_seconds: int = 24 * 60 * 60
