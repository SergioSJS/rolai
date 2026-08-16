// Dedupe do echo de rolagem. O backend faz broadcast pra todos os
// conectados, incluindo o remetente (serve de ack — ver rooms.py). Sem
// dedupe, quem rolou veria a propria rolagem animada duas vezes: uma no
// disparo local, outra quando o echo chega.
//
// O historico NAO e dedupado — a ordem canonica e a de chegada no
// servidor, entao o echo e o que entra no historico. So a animacao pula.

import type { RollResult } from "@rolai/rules-engine";

// Identidade de uma rolagem: quem rolou + timestamp ISO (ms) + notacao.
export function rollKey(player: string, result: RollResult): string {
  return `${player}${result.timestamp}${result.notation}`;
}

// Rastreia rolagens proprias ja animadas localmente e ainda nao confirmadas
// pelo echo. Multiset (contagem por chave) pra duas rolagens identicas no
// mesmo milissegundo nao colapsarem numa so.
export class PendingRolls {
  private counts = new Map<string, number>();

  track(player: string, result: RollResult): void {
    const key = rollKey(player, result);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  // Retorna true se o evento e o echo de uma rolagem nossa (e o consome —
  // cada echo casa com exatamente uma rolagem rastreada).
  consumeEcho(player: string, result: RollResult): boolean {
    const key = rollKey(player, result);
    const count = this.counts.get(key) ?? 0;
    if (count === 0) return false;
    if (count === 1) this.counts.delete(key);
    else this.counts.set(key, count - 1);
    return true;
  }

  get size(): number {
    return this.counts.size;
  }
}

// Mesmo problema do echo de rolagem, pro baralho (specs/08-baralho.md): a
// puxada anima local na hora (App.tsx), e o echo do broadcast nao pode
// animar de novo. Chave = player+timestamp (o timestamp e gerado uma unica
// vez em App.tsx e usado tanto pra animar quanto pro envelope WS, entao
// bate exatamente com o que volta no echo).
export class PendingDeckDraws {
  private counts = new Map<string, number>();

  track(player: string, timestamp: string): void {
    const key = `${player}${timestamp}`;
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  consumeEcho(player: string, timestamp: string): boolean {
    const key = `${player}${timestamp}`;
    const count = this.counts.get(key) ?? 0;
    if (count === 0) return false;
    if (count === 1) this.counts.delete(key);
    else this.counts.set(key, count - 1);
    return true;
  }
}
