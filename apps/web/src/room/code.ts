// Regras do codigo de sala escolhido a mao.
//
// ESPELHO da validacao do backend (`is_valid_custom_code` em
// services/backend/app/rooms.py). Quem MANDA e o backend — isto aqui existe
// so pra dizer o motivo antes de gastar uma conexao e receber um 4404 seco.
// Mudou la, muda aqui: o teste de regressao abaixo trava os numeros.
//
// Por que existe piso: nao ha login, entao o codigo E a credencial. Sem
// piso, `?room=teste` viraria sala publica adivinhavel (docs/security.md).

export const CUSTOM_CODE_MIN_LENGTH = 16;
export const CUSTOM_CODE_MIN_DISTINCT = 8;

const CODE_CHARS = /^[A-Za-z0-9_-]+$/;

/** `null` = pode virar sala. Senao, o motivo em texto pro usuario. */
export function customCodeIssue(code: string): string | null {
  const trimmed = code.trim();
  if (trimmed === "") return "digite um código";
  if (!CODE_CHARS.test(trimmed)) {
    return "use apenas letras, números, hífen e sublinhado";
  }
  if (trimmed.length > 32) return "no máximo 32 caracteres";
  if (trimmed.length < CUSTOM_CODE_MIN_LENGTH) {
    return `mínimo de ${CUSTOM_CODE_MIN_LENGTH} caracteres (tem ${trimmed.length})`;
  }
  if (new Set(trimmed).size < CUSTOM_CODE_MIN_DISTINCT) {
    return `use pelo menos ${CUSTOM_CODE_MIN_DISTINCT} caracteres diferentes`;
  }
  return null;
}
