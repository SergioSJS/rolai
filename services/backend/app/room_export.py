# Export do historico de uma sala em CSV e Markdown (a rota vive em
# rooms.py; aqui e so a formatacao de cada linha).
import csv
import io

from app.schemas import (
    DeckDrawHistoryEntry,
    DeckShuffleHistoryEntry,
    HistoryEntry,
    RollHistoryEntry,
)


def entry_timestamp(entry: HistoryEntry) -> str:
    """Hora do payload do cliente — quando rolou no aparelho."""
    if isinstance(entry, RollHistoryEntry):
        return entry.result.timestamp
    return entry.timestamp


def _history_row(entry: HistoryEntry) -> list[str]:
    if isinstance(entry, RollHistoryEntry):
        r = entry.result
        return [
            r.timestamp,
            entry.player,
            "roll",
            r.notation,
            r.profile or "",
            r.outcome or "",
            "|".join(r.outcome_flags or []),
            "",
        ]
    if isinstance(entry, DeckDrawHistoryEntry):
        cards = " ".join(f"{c.rank}{c.suit[:1]}" for c in entry.cards)
        return [
            entry.timestamp,
            entry.player,
            "deck_draw",
            "",
            "",
            "",
            "",
            f"{cards} (restam {entry.remaining})",
        ]
    if isinstance(entry, DeckShuffleHistoryEntry):
        return [entry.timestamp, entry.player, "deck_shuffle", "", "", "", "", ""]
    # DeckConfigHistoryEntry
    changes = ", ".join(
        f"{field}={value}"
        for field, value in (
            ("include_jokers", entry.include_jokers),
            ("removal_mode", entry.removal_mode),
            ("auto_reshuffle_on_empty", entry.auto_reshuffle_on_empty),
        )
        if value is not None
    )
    return [entry.timestamp, entry.player, "deck_config", "", "", "", "", changes]


_CSV_HEADER = [
    "received_at",
    "timestamp",
    "player",
    "type",
    "notation",
    "profile",
    "outcome",
    "outcome_flags",
    "detail",
]


def _history_csv(history: list[HistoryEntry]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(_CSV_HEADER)
    for entry in history:
        writer.writerow([entry.received_at or "", *_history_row(entry)])
    return buf.getvalue()


def filter_since(history: list[HistoryEntry], since: str | None) -> list[HistoryEntry]:
    """Aplica o mesmo corte que o "ocultar daqui pra tras" da UI.

    Compara `received_at > since` — string ISO em UTC, entao comparacao
    lexicografica basta. Entrada legada sem `received_at` (gravada antes deste
    campo existir) cai no `timestamp` do cliente: relogio menos confiavel, mas
    a alternativa seria vazar no export justamente o que foi ocultado.
    """
    if not since:
        return history
    return [e for e in history if (e.received_at or entry_timestamp(e)) > since]


def _history_markdown(code: str, history: list[HistoryEntry]) -> str:
    lines = [f"# Sala {code}", "", "| " + " | ".join(_CSV_HEADER) + " |"]
    lines.append("| " + " | ".join("---" for _ in _CSV_HEADER) + " |")
    for entry in history:
        row = [entry.received_at or "", *_history_row(entry)]
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines) + "\n"
