# Log estruturado do backend (docs/security.md — "Abuso e recursos").
#
# Logger unico "rolai", mensagens em formato key=value na propria string
# (ex.: "event=room_created code=AbCdEfGh ip=1.2.3.4") — estruturado o
# bastante pra grep/awk/Loki sem adicionar dependencia (structlog seria
# overkill pro volume de eventos daqui). INFO pra evento normal (sala
# criada, conexao WS aberta/fechada), WARNING pra limite atingido ou
# payload rejeitado. NUNCA logar payload de rolagem — metadados bastam.
import logging

log = logging.getLogger("rolai")


def configure_logging() -> None:
    """Formato padrao se ninguem configurou logging ainda (pytest injeta os
    proprios handlers — ai so garantimos que eventos INFO passem)."""
    if not logging.getLogger().handlers:
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s %(levelname)s %(name)s %(message)s",
        )
    log.setLevel(logging.INFO)
