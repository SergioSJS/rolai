import { describe, expect, it } from "vitest";
import { rollWithProfile } from "../../src/index.js";

// profiles/infaernum_sim_ou_nao.yaml: 1d6 + chance (-1/0/+1). sim (total>=4),
// nao (total<4). "Provavel"/"Improvavel" empurram o dado antes da comparacao.

describe("profile: infaernum_sim_ou_nao", () => {
  it("sim: total >= 4 (neutro)", async () => {
    const result = await rollWithProfile("infaernum_sim_ou_nao", { chance: "0" }, {
      deterministic: [4],
    });
    expect(result.profile).toBe("infaernum_sim_ou_nao");
    expect(result.notation).toBe("1d6+0");
    expect(result.groups["roll"]).toEqual({ rolls: [4], modifier: 0, total: 4 });
    expect(result.outcome).toBe("sim");
  });

  it("nao: total < 4 (neutro)", async () => {
    const result = await rollWithProfile("infaernum_sim_ou_nao", { chance: "0" }, {
      deterministic: [3],
    });
    expect(result.outcome).toBe("nao");
  });

  it("provavel: +1 empurra 3 pra sim", async () => {
    const result = await rollWithProfile("infaernum_sim_ou_nao", { chance: "1" }, {
      deterministic: [3],
    });
    expect(result.notation).toBe("1d6+1");
    expect(result.groups["roll"]!.total).toBe(4);
    expect(result.outcome).toBe("sim");
  });

  it("improvavel: -1 empurra 4 pra nao", async () => {
    const result = await rollWithProfile("infaernum_sim_ou_nao", { chance: "-1" }, {
      deterministic: [4],
    });
    expect(result.notation).toBe("1d6-1");
    expect(result.groups["roll"]!.total).toBe(3);
    expect(result.outcome).toBe("nao");
  });
});
