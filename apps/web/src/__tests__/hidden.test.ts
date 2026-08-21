// Corte do "ocultar daqui pra trás" (room/hidden.ts, specs/09-limpar-historico.md).
import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "../room/reducer";
import {
  cutoffForCurrent,
  entryStamp,
  loadHiddenBefore,
  saveHiddenBefore,
  visibleEntries,
} from "../room/hidden";

function roll(receivedAt: string | undefined, timestamp = "2026-08-20T00:00:00.000Z"): HistoryEntry {
  const entry: HistoryEntry = {
    type: "roll",
    player: "ana",
    result: { notation: "1d20", groups: { roll: { rolls: [11], total: 11 } }, timestamp },
  };
  if (receivedAt !== undefined) entry.receivedAt = receivedAt;
  return entry;
}

describe("entryStamp", () => {
  it("prefere o carimbo do servidor ao timestamp do cliente", () => {
    // O do cliente é o relógio de quem rolou; o do servidor é o que dá ordem.
    const entry = roll("2026-08-20T10:00:00.000000+00:00", "2020-01-01T00:00:00.000Z");
    expect(entryStamp(entry)).toBe("2026-08-20T10:00:00.000000+00:00");
  });

  it("cai no timestamp do payload quando a entrada é legada", () => {
    expect(entryStamp(roll(undefined, "2026-08-20T09:00:00.000Z"))).toBe(
      "2026-08-20T09:00:00.000Z",
    );
  });
});

describe("visibleEntries", () => {
  const entries = [
    roll("2026-08-20T10:00:00.000000+00:00"),
    roll("2026-08-20T10:00:01.000000+00:00"),
    roll("2026-08-20T10:00:02.000000+00:00"),
  ];

  it("sem corte mostra tudo", () => {
    expect(visibleEntries(entries, null)).toHaveLength(3);
  });

  it("esconde a entrada do corte e tudo antes dela", () => {
    const visiveis = visibleEntries(entries, "2026-08-20T10:00:01.000000+00:00");
    expect(visiveis).toHaveLength(1);
    expect(entryStamp(visiveis[0]!)).toBe("2026-08-20T10:00:02.000000+00:00");
  });

  it("corte de uma sala que perdeu entradas pro LTRIM não esconde nada", () => {
    // Reconectar traz snapshot novo, sem as antigas. Todas as que sobraram
    // são mais novas que o corte — esconder nada é o certo, não um bug.
    const depoisDoTrim = [roll("2026-08-20T11:00:00.000000+00:00")];
    expect(visibleEntries(depoisDoTrim, "2026-08-20T10:00:01.000000+00:00")).toHaveLength(1);
  });
});

describe("cutoffForCurrent", () => {
  it("usa o carimbo da última entrada, não o relógio local", () => {
    // Guardar `new Date()` traria de volta o skew entre a máquina e o
    // servidor: relógio atrasado guardaria corte menor que os carimbos que
    // já existem e não esconderia nada, sem erro nenhum.
    const entries = [roll("2026-08-20T10:00:00.000000+00:00"), roll("2026-08-20T10:00:09.000000+00:00")];
    expect(cutoffForCurrent(entries)).toBe("2026-08-20T10:00:09.000000+00:00");
  });

  it("histórico vazio não gera corte", () => {
    expect(cutoffForCurrent([])).toBeNull();
  });
});

describe("persistência do corte", () => {
  it("guarda e apaga por escopo", () => {
    saveHiddenBefore(window.localStorage, "sala-a", "2026-08-20T10:00:00.000000+00:00");
    saveHiddenBefore(window.localStorage, "sala-b", "2026-08-20T11:00:00.000000+00:00");

    // Escopo separado: entrar em outra sala não herda corte alheio.
    expect(loadHiddenBefore(window.localStorage, "sala-a")).toBe(
      "2026-08-20T10:00:00.000000+00:00",
    );
    expect(loadHiddenBefore(window.localStorage, "sala-c")).toBeNull();

    saveHiddenBefore(window.localStorage, "sala-a", null);
    expect(loadHiddenBefore(window.localStorage, "sala-a")).toBeNull();
    expect(loadHiddenBefore(window.localStorage, "sala-b")).toBe(
      "2026-08-20T11:00:00.000000+00:00",
    );
  });
});
