import { describe, expect, it } from 'vitest';
import { slugify, withRandomSuffix } from './slug.util';

describe('slug.util', () => {
  it('lowercases and hyphenates a display name', () => {
    expect(slugify('Acme Corp!')).toEqual('acme-corp');
  });

  it('trims leading/trailing separators produced by punctuation', () => {
    expect(slugify('  --Foo Bar--  ')).toEqual('foo-bar');
  });

  it('falls back to a default slug for empty/degenerate input', () => {
    expect(slugify('   ')).toEqual('org');
    expect(slugify('!!!')).toEqual('org');
  });

  it('appends a random suffix distinct from the base', () => {
    const suffixed = withRandomSuffix('acme-corp');
    expect(suffixed.startsWith('acme-corp-')).toBe(true);
    expect(suffixed).not.toEqual('acme-corp');
  });
});
