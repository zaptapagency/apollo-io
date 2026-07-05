import { describe, expect, it } from 'vitest';
import { coerceCompanyRow, coerceContactRow, validateCompanyRow, validateContactRow } from './csv-row-validation';

describe('coerceCompanyRow', () => {
  it('trims strings and converts empty strings to undefined', () => {
    const result = coerceCompanyRow({ name: '  Acme  ', domain: '', industry: 'SaaS' });
    expect(result.name).toBe('Acme');
    expect(result.domain).toBeUndefined();
    expect(result.industry).toBe('SaaS');
  });

  it('parses numeric columns, leaving unparseable values as undefined instead of NaN', () => {
    const result = coerceCompanyRow({ name: 'Acme', employeeCount: '250', annualRevenue: 'not-a-number' });
    expect(result.employeeCount).toBe(250);
    expect(result.annualRevenue).toBeUndefined();
  });

  it('splits techStack on the pipe character and trims each entry', () => {
    const result = coerceCompanyRow({ name: 'Acme', techStack: 'React | Node.js |Postgres' });
    expect(result.techStack).toEqual(['React', 'Node.js', 'Postgres']);
  });

  it('defaults techStack to an empty array when absent', () => {
    const result = coerceCompanyRow({ name: 'Acme' });
    expect(result.techStack).toEqual([]);
  });
});

describe('coerceContactRow', () => {
  it('trims strings and converts empty strings to undefined', () => {
    const result = coerceContactRow({ firstName: ' Jane ', lastName: 'Doe', email: '' });
    expect(result.firstName).toBe('Jane');
    expect(result.lastName).toBe('Doe');
    expect(result.email).toBeUndefined();
  });
});

describe('validateCompanyRow', () => {
  it('accepts a valid row and returns the coerced/parsed data', () => {
    const result = validateCompanyRow({ name: 'Acme', domain: 'acme.com', employeeCount: '50' }, 2);

    expect(result.valid).toBe(true);
    expect(result.row).toBe(2);
    expect(result.data?.name).toBe('Acme');
    expect(result.data?.employeeCount).toBe(50);
  });

  it('rejects a row missing the required name field, with a 1-based row number and a message', () => {
    const result = validateCompanyRow({ domain: 'acme.com' }, 5);

    expect(result.valid).toBe(false);
    expect(result.row).toBe(5);
    expect(result.data).toBeUndefined();
    expect(result.errors).toBeDefined();
    expect(result.errors?.some((e) => e.includes('name'))).toBe(true);
  });

  it('rejects a row with an invalid linkedinUrl', () => {
    const result = validateCompanyRow({ name: 'Acme', linkedinUrl: 'not-a-url' }, 3);

    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes('linkedinUrl'))).toBe(true);
  });
});

describe('validateContactRow', () => {
  it('accepts a valid row', () => {
    const result = validateContactRow({ firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com' }, 2);

    expect(result.valid).toBe(true);
    expect(result.data?.firstName).toBe('Jane');
    expect(result.data?.email).toBe('jane@acme.com');
  });

  it('rejects a row missing required firstName/lastName fields', () => {
    const result = validateContactRow({ email: 'jane@acme.com' }, 4);

    expect(result.valid).toBe(false);
    expect(result.row).toBe(4);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('rejects a row with an invalid email', () => {
    const result = validateContactRow({ firstName: 'Jane', lastName: 'Doe', email: 'not-an-email' }, 2);

    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes('email'))).toBe(true);
  });
});
