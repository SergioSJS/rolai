// Avaliador de expressao restrito para as `condition` de outcome_rules
// (docs/system-profiles.md). Parser proprio — NUNCA eval/Function, pra que
// um profile custom malicioso nao injete codigo (docs/security.md).
//
// Gramatica (precedencia da mais fraca pra mais forte):
//   or      := xor ("or" xor)*
//   xor     := and ("xor" and)*
//   and     := not ("and" not)*
//   not     := "not" not | comparison
//   comparison := additive ((">"|">="|"<"|"<="|"=="|"!=") additive)?
//   additive  := multiplicative (("+"|"-") multiplicative)*
//   multiplicative := unary (("*"|"/") unary)*
//   unary     := "-" unary | primary
//   primary   := number | string | "(" or ")" | reference | funcall
//   reference := ident ("." ident | "[" number "]")*
//   funcall   := ident "(" arg ("," arg)* ")"   — count/max/min apenas

export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpressionError";
  }
}

// Um field de profile visto pelo avaliador: array de rolagens + total e
// modificador opcionais.
export interface FieldValue {
  rolls: number[];
  total?: number;
  modifier?: number;
}

export type ExpressionScope = Record<string, FieldValue>;

type Value = number | boolean | number[];

// ---------- Lexer ----------

interface Token {
  kind: "number" | "string" | "ident" | "op" | "punct" | "eof";
  text: string;
}

const OPERATORS = [">=", "<=", "==", "!=", ">", "<", "+", "-", "*", "/"];
const PUNCT = ["(", ")", "[", "]", ",", "."];

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(input[i + 1] ?? ""))) {
      const m = /^\d*\.?\d+/.exec(input.slice(i))!;
      tokens.push({ kind: "number", text: m[0] });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(input.slice(i))!;
      tokens.push({ kind: "ident", text: m[0] });
      i += m[0].length;
      continue;
    }
    if (ch === "'") {
      const end = input.indexOf("'", i + 1);
      if (end === -1) {
        throw new ExpressionError(`string nao terminada em: "${input}"`);
      }
      tokens.push({ kind: "string", text: input.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    const op = OPERATORS.find((o) => input.startsWith(o, i));
    if (op) {
      tokens.push({ kind: "op", text: op });
      i += op.length;
      continue;
    }
    if (PUNCT.includes(ch)) {
      tokens.push({ kind: "punct", text: ch });
      i++;
      continue;
    }
    throw new ExpressionError(`caractere invalido "${ch}" em: "${input}"`);
  }
  tokens.push({ kind: "eof", text: "" });
  return tokens;
}

// ---------- AST ----------

type Node =
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "ref"; name: string; path: ({ member: string } | { index: number })[] }
  | { kind: "call"; fn: string; args: Node[] }
  | { kind: "unary"; op: "-" | "not"; operand: Node }
  | { kind: "binary"; op: string; left: Node; right: Node };

// ---------- Parser ----------

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos]!;
  }

  private next(): Token {
    return this.tokens[this.pos++]!;
  }

  private expect(kind: Token["kind"], text?: string): Token {
    const t = this.next();
    if (t.kind !== kind || (text !== undefined && t.text !== text)) {
      throw new ExpressionError(
        `esperado "${text ?? kind}", encontrado "${t.text || t.kind}"`,
      );
    }
    return t;
  }

  parse(): Node {
    const node = this.parseOr();
    if (this.peek().kind !== "eof") {
      throw new ExpressionError(`token inesperado: "${this.peek().text}"`);
    }
    return node;
  }

  private isKeyword(word: string): boolean {
    const t = this.peek();
    return t.kind === "ident" && t.text.toLowerCase() === word;
  }

  parseOr(): Node {
    let left = this.parseXor();
    while (this.isKeyword("or")) {
      this.next();
      left = { kind: "binary", op: "or", left, right: this.parseXor() };
    }
    return left;
  }

  private parseXor(): Node {
    let left = this.parseAnd();
    while (this.isKeyword("xor")) {
      this.next();
      left = { kind: "binary", op: "xor", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Node {
    let left = this.parseNot();
    while (this.isKeyword("and")) {
      this.next();
      left = { kind: "binary", op: "and", left, right: this.parseNot() };
    }
    return left;
  }

  private parseNot(): Node {
    if (this.isKeyword("not")) {
      this.next();
      return { kind: "unary", op: "not", operand: this.parseNot() };
    }
    return this.parseComparison();
  }

  private parseComparison(): Node {
    const left = this.parseAdditive();
    const t = this.peek();
    if (t.kind === "op" && [">", ">=", "<", "<=", "==", "!="].includes(t.text)) {
      this.next();
      return { kind: "binary", op: t.text, left, right: this.parseAdditive() };
    }
    return left;
  }

  private parseAdditive(): Node {
    let left = this.parseMultiplicative();
    while (this.peek().kind === "op" && ["+", "-"].includes(this.peek().text)) {
      const op = this.next().text;
      left = { kind: "binary", op, left, right: this.parseMultiplicative() };
    }
    return left;
  }

  private parseMultiplicative(): Node {
    let left = this.parseUnary();
    while (this.peek().kind === "op" && ["*", "/"].includes(this.peek().text)) {
      const op = this.next().text;
      left = { kind: "binary", op, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): Node {
    const t = this.peek();
    if (t.kind === "op" && t.text === "-") {
      this.next();
      return { kind: "unary", op: "-", operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Node {
    const t = this.peek();
    if (t.kind === "number") {
      this.next();
      return { kind: "number", value: Number(t.text) };
    }
    if (t.kind === "string") {
      this.next();
      return { kind: "string", value: t.text };
    }
    if (t.kind === "punct" && t.text === "(") {
      this.next();
      const node = this.parseOr();
      this.expect("punct", ")");
      return node;
    }
    if (t.kind === "ident") {
      this.next();
      const name = t.text;
      if (this.peek().kind === "punct" && this.peek().text === "(") {
        this.next();
        const args: Node[] = [this.parseOr()];
        while (this.peek().kind === "punct" && this.peek().text === ",") {
          this.next();
          args.push(this.parseOr());
        }
        this.expect("punct", ")");
        return { kind: "call", fn: name.toLowerCase(), args };
      }
      const path: ({ member: string } | { index: number })[] = [];
      for (;;) {
        const p = this.peek();
        if (p.kind === "punct" && p.text === ".") {
          this.next();
          path.push({ member: this.expect("ident").text });
        } else if (p.kind === "punct" && p.text === "[") {
          this.next();
          const idx = this.expect("number");
          const n = Number(idx.text);
          if (!Number.isInteger(n) || n < 0) {
            throw new ExpressionError(`indice invalido: "${idx.text}"`);
          }
          path.push({ index: n });
          this.expect("punct", "]");
        } else {
          break;
        }
      }
      return { kind: "ref", name, path };
    }
    throw new ExpressionError(`expressao inesperada: "${t.text || t.kind}"`);
  }
}

// ---------- Avaliador ----------

const CONDITION_STRING = /^(>=|<=|==|!=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/;

// Minilinguagem de condicao ("'>=6'", "'==1'") usada pelo count() e por
// ProfileField.success_rule (profile.ts) — um so lugar pra parsear "op
// valor", pra nao duplicar a regex/comparacao entre os dois usos.
export function matchesCondition(value: number, condition: string): boolean {
  const m = CONDITION_STRING.exec(condition);
  if (!m) {
    throw new ExpressionError(`condicao invalida: '${condition}'`);
  }
  const target = Number(m[2]);
  const op = m[1] === "=" ? "==" : m[1]!;
  return evaluateComparison(op, value, target);
}

function truthy(v: Value): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return v.length > 0;
}

function asNumber(v: Value, context: string): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  throw new ExpressionError(`${context}: esperado numero, encontrado array`);
}

function asArray(v: Value, context: string): number[] {
  if (Array.isArray(v)) return v;
  throw new ExpressionError(`${context}: esperado array, encontrado ${typeof v}`);
}

function evaluate(node: Node, scope: ExpressionScope): Value {
  switch (node.kind) {
    case "number":
      return node.value;
    case "string":
      // Strings so sao validas como argumento de funcao (count); tratadas
      // aqui como erro fora desse contexto.
      throw new ExpressionError(`string fora de contexto: '${node.value}'`);
    case "ref": {
      const field = scope[node.name];
      if (field === undefined) {
        throw new ExpressionError(`campo desconhecido: "${node.name}"`);
      }
      let value: Value = field.rolls;
      for (const step of node.path) {
        if ("member" in step) {
          if (step.member === "rolls") {
            value = field.rolls;
          } else if (step.member === "total") {
            if (field.total === undefined) {
              throw new ExpressionError(
                `campo "${node.name}" nao tem total (compare_individually?)`,
              );
            }
            value = field.total;
          } else if (step.member === "modifier") {
            if (field.modifier === undefined) {
              throw new ExpressionError(`campo "${node.name}" nao tem modifier`);
            }
            value = field.modifier;
          } else {
            throw new ExpressionError(
              `membro desconhecido: "${node.name}.${step.member}"`,
            );
          }
        } else {
          const arr = asArray(value, `indexacao de "${node.name}"`);
          const item = arr[step.index];
          if (item === undefined) {
            throw new ExpressionError(
              `indice ${step.index} fora do array "${node.name}" (${arr.length} elementos)`,
            );
          }
          value = item;
        }
      }
      return value;
    }
    case "call": {
      const args = node.args;
      switch (node.fn) {
        case "count": {
          if (args.length !== 2) {
            throw new ExpressionError("count(field, condicao) exige 2 argumentos");
          }
          const arr = asArray(evaluate(args[0]!, scope), "count");
          const condNode = args[1]!;
          if (condNode.kind !== "string") {
            throw new ExpressionError(
              "segundo argumento de count deve ser string, ex: '>=6'",
            );
          }
          return arr.filter((v) => matchesCondition(v, condNode.value)).length;
        }
        case "max": {
          const arr = asArray(evaluate(args[0]!, scope), "max");
          if (args.length !== 1 || arr.length === 0) {
            throw new ExpressionError("max(field) exige array nao vazio");
          }
          return Math.max(...arr);
        }
        case "min": {
          const arr = asArray(evaluate(args[0]!, scope), "min");
          if (args.length !== 1 || arr.length === 0) {
            throw new ExpressionError("min(field) exige array nao vazio");
          }
          return Math.min(...arr);
        }
        default:
          throw new ExpressionError(`funcao nao permitida: "${node.fn}"`);
      }
    }
    case "unary": {
      if (node.op === "not") return !truthy(evaluate(node.operand, scope));
      return -asNumber(evaluate(node.operand, scope), "negacao unaria");
    }
    case "binary": {
      const { op } = node;
      if (op === "and") {
        return truthy(evaluate(node.left, scope)) && truthy(evaluate(node.right, scope));
      }
      if (op === "or") {
        return truthy(evaluate(node.left, scope)) || truthy(evaluate(node.right, scope));
      }
      if (op === "xor") {
        return truthy(evaluate(node.left, scope)) !== truthy(evaluate(node.right, scope));
      }
      const left = asNumber(evaluate(node.left, scope), `operador "${op}"`);
      const right = asNumber(evaluate(node.right, scope), `operador "${op}"`);
      switch (op) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          return left / right;
        default:
          return evaluateComparison(op, left, right);
      }
    }
  }
}

function evaluateComparison(op: string, left: number, right: number): boolean {
  switch (op) {
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    default:
      throw new ExpressionError(`operador desconhecido: "${op}"`);
  }
}

// Parseia sem avaliar — usado no carregamento do profile pra falhar cedo
// em condition invalida.
export function parseExpression(condition: string): void {
  new Parser(tokenize(condition)).parse();
}

// Avalia uma condition contra os campos do resultado. Retorna boolean.
export function evaluateExpression(
  condition: string,
  scope: ExpressionScope,
): boolean {
  const ast = new Parser(tokenize(condition)).parse();
  return truthy(evaluate(ast, scope));
}
