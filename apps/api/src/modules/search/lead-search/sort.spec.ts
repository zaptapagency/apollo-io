import { describe, expect, it } from 'vitest';
import { resolveCompanySort, resolveContactSort } from './sort';

describe('resolveCompanySort', () => {
  it('defaults to createdAt when sortBy is undefined', () => {
    expect(resolveCompanySort(undefined, 'desc')).toEqual({ createdAt: 'desc' });
  });

  it('defaults to createdAt when sortBy is not an allowlisted column', () => {
    expect(resolveCompanySort('organizationId', 'asc')).toEqual({ createdAt: 'asc' });
  });

  it('resolves an allowlisted column, preserving the requested direction', () => {
    expect(resolveCompanySort('annualRevenue', 'desc')).toEqual({ annualRevenue: 'desc' });
    expect(resolveCompanySort('employeeCount', 'asc')).toEqual({ employeeCount: 'asc' });
  });
});

describe('resolveContactSort', () => {
  it('defaults to createdAt when sortBy is undefined', () => {
    expect(resolveContactSort(undefined, 'asc')).toEqual({ createdAt: 'asc' });
  });

  it('defaults to createdAt when sortBy is not an allowlisted column', () => {
    expect(resolveContactSort('email', 'desc')).toEqual({ createdAt: 'desc' });
  });

  it('resolves an allowlisted column, preserving the requested direction', () => {
    expect(resolveContactSort('emailScore', 'desc')).toEqual({ emailScore: 'desc' });
    expect(resolveContactSort('lastName', 'asc')).toEqual({ lastName: 'asc' });
  });
});
