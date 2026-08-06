// API publica do @rolai/rules-engine — ver specs/01-rules-engine.md.
// Pacote puro: sem rede, sem DOM, sem renderizacao.

export * from "./types.js";
export {
  parseNotation,
  parseDiceExpression,
  NotationError,
} from "./parser.js";
export type {
  NotationAST,
  GroupSpec,
  DiceSpec,
  DiceTerm,
  KeepDropSpec,
  RerollSpec,
  ComparisonOp,
  KeepDropType,
} from "./parser.js";
export { roll, rollAST, rollDice, rollGroup, createRollState } from "./roller.js";
export type { RollOptions, RollState } from "./roller.js";
export { cryptoRandomSource, rollDie } from "./rng.js";
export {
  evaluateExpression,
  parseExpression,
  ExpressionError,
} from "./expression.js";
export type { ExpressionScope, FieldValue } from "./expression.js";
export {
  parseProfile,
  loadProfile,
  rollWithProfile,
  evaluateOutcomeRules,
  ProfileError,
} from "./profile.js";
export type {
  SystemProfile,
  ProfileInput,
  ProfileField,
  OutcomeRule,
  ProfileInputs,
} from "./profile.js";
