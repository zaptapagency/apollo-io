import type { Prisma } from '@prospect/db';

/**
 * Tiny boolean-query parser for `ContactFilter.booleanQuery`, e.g.
 * `VP AND (Sales OR Marketing) AND NOT Intern`.
 *
 * Grammar (case-insensitive `AND`/`OR`/`NOT` keywords):
 *   expr   := term (OR term)*
 *   term   := factor (AND factor)*
 *   factor := NOT factor | '(' expr ')' | WORD
 *
 * A bare WORD matches if it appears (case-insensitively) in the contact's title, department,
 * first name, or last name — the same fields `contactKeyword` searches, since "boolean search"
 * in Apollo-style tools is really a boolean combination of keyword matches, not a single field.
 */
export function parseBooleanQuery(query: string): Prisma.ContactWhereInput | undefined {
  const trimmed = query.trim();
  if (!trimmed) return undefined;

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return undefined;

  const parser = new Parser(tokens);
  const result = parser.parseExpr();
  if (!parser.isAtEnd()) {
    throw new Error(`Unexpected token "${parser.peek()}" in boolean query: ${query}`);
  }
  return result;
}

function tokenize(query: string): string[] {
  const matches = query.match(/\(|\)|"[^"]*"|[^\s()]+/g);
  return matches ?? [];
}

class Parser {
  private pos = 0;

  constructor(private readonly tokens: string[]) {}

  isAtEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  peek(): string | undefined {
    return this.tokens[this.pos];
  }

  private next(): string {
    const token = this.tokens[this.pos];
    if (token === undefined) throw new Error('Unexpected end of boolean query');
    this.pos += 1;
    return token;
  }

  private isKeyword(token: string | undefined, keyword: string): boolean {
    return token !== undefined && token.toUpperCase() === keyword;
  }

  parseExpr(): Prisma.ContactWhereInput {
    const first = this.parseTerm();
    const rest: Prisma.ContactWhereInput[] = [];
    while (this.isKeyword(this.peek(), 'OR')) {
      this.next();
      rest.push(this.parseTerm());
    }
    return rest.length === 0 ? first : { OR: [first, ...rest] };
  }

  private parseTerm(): Prisma.ContactWhereInput {
    const first = this.parseFactor();
    const rest: Prisma.ContactWhereInput[] = [];
    while (
      this.peek() !== undefined &&
      !this.isKeyword(this.peek(), 'OR') &&
      this.peek() !== ')'
    ) {
      if (this.isKeyword(this.peek(), 'AND')) this.next();
      rest.push(this.parseFactor());
    }
    return rest.length === 0 ? first : { AND: [first, ...rest] };
  }

  private parseFactor(): Prisma.ContactWhereInput {
    if (this.isKeyword(this.peek(), 'NOT')) {
      this.next();
      return { NOT: this.parseFactor() };
    }
    if (this.peek() === '(') {
      this.next();
      const inner = this.parseExpr();
      if (this.peek() !== ')') {
        throw new Error('Unbalanced parentheses in boolean query');
      }
      this.next();
      return inner;
    }
    const raw = this.next();
    const word = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    return wordClause(word);
  }
}

function wordClause(word: string): Prisma.ContactWhereInput {
  return {
    OR: [
      { title: { contains: word, mode: 'insensitive' } },
      { department: { contains: word, mode: 'insensitive' } },
      { firstName: { contains: word, mode: 'insensitive' } },
      { lastName: { contains: word, mode: 'insensitive' } },
    ],
  };
}
