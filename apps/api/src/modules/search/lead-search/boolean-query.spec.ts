import { describe, expect, it } from 'vitest';
import { parseBooleanQuery } from './boolean-query';

function wordClause(word: string) {
  return {
    OR: [
      { title: { contains: word, mode: 'insensitive' } },
      { department: { contains: word, mode: 'insensitive' } },
      { firstName: { contains: word, mode: 'insensitive' } },
      { lastName: { contains: word, mode: 'insensitive' } },
    ],
  };
}

describe('parseBooleanQuery', () => {
  it('returns undefined for an empty/whitespace-only query', () => {
    expect(parseBooleanQuery('')).toBeUndefined();
    expect(parseBooleanQuery('   ')).toBeUndefined();
  });

  it('parses a single bare word into a wordClause', () => {
    expect(parseBooleanQuery('VP')).toEqual(wordClause('VP'));
  });

  it('parses a quoted phrase, stripping the quotes', () => {
    expect(parseBooleanQuery('"Vice President"')).toEqual(wordClause('Vice President'));
  });

  it('parses AND into an AND clause', () => {
    expect(parseBooleanQuery('VP AND Sales')).toEqual({
      AND: [wordClause('VP'), wordClause('Sales')],
    });
  });

  it('treats two adjacent words with no operator as an implicit AND', () => {
    expect(parseBooleanQuery('VP Sales')).toEqual({
      AND: [wordClause('VP'), wordClause('Sales')],
    });
  });

  it('parses OR into an OR clause', () => {
    expect(parseBooleanQuery('Sales OR Marketing')).toEqual({
      OR: [wordClause('Sales'), wordClause('Marketing')],
    });
  });

  it('parses NOT into a negated clause', () => {
    expect(parseBooleanQuery('NOT Intern')).toEqual({ NOT: wordClause('Intern') });
  });

  it('is case-insensitive for the AND/OR/NOT keywords', () => {
    expect(parseBooleanQuery('VP and Sales')).toEqual({
      AND: [wordClause('VP'), wordClause('Sales')],
    });
    expect(parseBooleanQuery('VP or Sales')).toEqual({
      OR: [wordClause('VP'), wordClause('Sales')],
    });
    expect(parseBooleanQuery('not Intern')).toEqual({ NOT: wordClause('Intern') });
  });

  it('respects parentheses to override default AND/OR precedence', () => {
    expect(parseBooleanQuery('VP AND (Sales OR Marketing)')).toEqual({
      AND: [wordClause('VP'), { OR: [wordClause('Sales'), wordClause('Marketing')] }],
    });
  });

  it('gives AND higher precedence than OR when no parens are present', () => {
    // "A OR B AND C" should parse as "A OR (B AND C)"
    expect(parseBooleanQuery('A OR B AND C')).toEqual({
      OR: [wordClause('A'), { AND: [wordClause('B'), wordClause('C')] }],
    });
  });

  it('combines AND, OR, and NOT with parentheses in a single query', () => {
    expect(parseBooleanQuery('VP AND (Sales OR Marketing) AND NOT Intern')).toEqual({
      AND: [
        wordClause('VP'),
        { OR: [wordClause('Sales'), wordClause('Marketing')] },
        { NOT: wordClause('Intern') },
      ],
    });
  });

  it('supports nested parentheses', () => {
    expect(parseBooleanQuery('(VP AND (Sales OR Marketing))')).toEqual({
      AND: [wordClause('VP'), { OR: [wordClause('Sales'), wordClause('Marketing')] }],
    });
  });

  it('supports NOT applied to a parenthesized group', () => {
    expect(parseBooleanQuery('NOT (Sales OR Marketing)')).toEqual({
      NOT: { OR: [wordClause('Sales'), wordClause('Marketing')] },
    });
  });

  it('throws on unbalanced parentheses', () => {
    expect(() => parseBooleanQuery('(VP AND Sales')).toThrow(/Unbalanced parentheses/);
  });

  it('throws on a trailing unexpected token', () => {
    expect(() => parseBooleanQuery('VP)')).toThrow(/Unexpected token/);
  });
});
