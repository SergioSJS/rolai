// Fonte de RNG injetavel. Default: crypto.getRandomValues, disponivel em
// Node 18+ (global webcrypto), browser e WebView Android. NUNCA usar
// Math.random() puro — ver docs/security.md.
//
// Copia deliberada do mesmo padrao em packages/rules-engine/src/rng.ts:
// pacotes independentes, sem acoplar deck-engine a rules-engine por uma
// funcao utilitaria de ~10 linhas que nao e "motor de regras".

import type { RandomSource } from "./types.js";

function requireCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== "function") {
    throw new Error(
      "crypto.getRandomValues indisponivel neste ambiente — injete um RandomSource explicito",
    );
  }
  return c;
}

// RandomSource default: uniforme em [0, 1) via 32 bits do CSPRNG.
export const cryptoRandomSource: RandomSource = () => {
  const buf = new Uint32Array(1);
  requireCrypto().getRandomValues(buf);
  const value = buf[0];
  if (value === undefined) {
    // impossivel na pratica (buffer de 1 elemento), mas noUncheckedIndexedAccess
    throw new Error("falha ao ler bytes aleatorios");
  }
  return value / 2 ** 32;
};
