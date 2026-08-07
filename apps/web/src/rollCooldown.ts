// Freio de spam de rolagem — proteção de MESA, não de servidor.
//
// O incômodo é social: alguém segurando o botão enche o histórico dos
// outros e cobre a tela de dado. Sozinho, ou offline, isso não incomoda
// ninguém além de quem está rolando — então o freio não existe nesse caso.
// Quem limita abuso de verdade é o backend (docs/security.md).
//
// Janela deslizante: N rolagens dentro de WINDOW_MS disparam a espera. Não
// é token bucket — a intenção é "parou de brincar de metralhadora", e uma
// contagem simples é mais fácil de explicar ao usuário na mensagem.

export const BURST_LIMIT = 5;
export const BURST_WINDOW_MS = 4000;
export const COOLDOWN_MS = 3000;

export interface CooldownState {
  /** Instantes das rolagens recentes, mais antiga primeiro. */
  recent: number[];
  /** Enquanto `now` for menor que isto, rolar está bloqueado. */
  blockedUntil: number;
}

export const initialCooldown: CooldownState = { recent: [], blockedUntil: 0 };

export interface CooldownVerdict {
  allowed: boolean;
  state: CooldownState;
  /** Segundos restantes, arredondados pra cima — só quando bloqueado. */
  waitSeconds?: number;
}

/**
 * @param players quantidade de gente na sala (1 ou 0 = sozinho/offline).
 */
export function checkCooldown(
  state: CooldownState,
  now: number,
  players: number,
): CooldownVerdict {
  // Sozinho ou offline: sem freio. O único prejudicado seria quem rola.
  if (players <= 1) return { allowed: true, state: initialCooldown };

  if (now < state.blockedUntil) {
    return {
      allowed: false,
      state,
      waitSeconds: Math.ceil((state.blockedUntil - now) / 1000),
    };
  }

  const recent = [...state.recent.filter((t) => now - t < BURST_WINDOW_MS), now];
  if (recent.length > BURST_LIMIT) {
    return {
      allowed: false,
      // Zera a janela: senão, saindo do bloqueio a próxima rolagem já
      // estouraria de novo e a pessoa ficaria presa num loop de espera.
      state: { recent: [], blockedUntil: now + COOLDOWN_MS },
      waitSeconds: Math.ceil(COOLDOWN_MS / 1000),
    };
  }
  return { allowed: true, state: { recent, blockedUntil: 0 } };
}
