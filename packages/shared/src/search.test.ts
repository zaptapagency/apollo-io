import { describe, expect, it } from 'vitest';
import { leadSearchSchema, saveSearchSchema } from './search';

describe('leadSearchSchema', () => {
  it('applies pagination defaults', () => {
    const parsed = leadSearchSchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(25);
    expect(parsed.sortDir).toBe('desc');
  });

  it('accepts a combination of company, contact, and engagement facets', () => {
    const parsed = leadSearchSchema.parse({
      company: { industry: ['Software'], employeeCountMin: 50 },
      contact: { seniority: ['VP', 'C_SUITE'], hasEmail: true },
      engagement: { neverContacted: true },
      page: 2,
      pageSize: 50,
    });
    expect(parsed.company?.industry).toEqual(['Software']);
    expect(parsed.contact?.seniority).toEqual(['VP', 'C_SUITE']);
    expect(parsed.engagement?.neverContacted).toBe(true);
  });

  it('rejects an invalid seniority value', () => {
    expect(() =>
      leadSearchSchema.parse({ contact: { seniority: ['NOT_REAL'] } }),
    ).toThrow();
  });
});

describe('saveSearchSchema', () => {
  it('requires a non-empty name', () => {
    expect(() =>
      saveSearchSchema.parse({ name: '', entity: 'CONTACT', filters: {} }),
    ).toThrow();
  });
});
