import { createCompanySchema, createContactSchema } from '@prospect/shared';
import type { CreateCompanyInput, CreateContactInput } from '@prospect/shared';

export interface RowValidationResult<T> {
  row: number;
  valid: boolean;
  data?: T;
  errors?: string[];
}

function emptyToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function toNumber(value: string | undefined): number | undefined {
  const trimmed = emptyToUndefined(value);
  if (trimmed === undefined) return undefined;
  const n = Number(trimmed);
  return Number.isNaN(n) ? undefined : n;
}

/** Coerces a raw CSV row (all string values) into the loosely-typed shape `createCompanySchema`
 * expects, before zod does the real validation. Unparseable numbers are left `undefined` (rather
 * than `NaN`) so zod reports a clean "required" error instead of an opaque NaN failure. */
export function coerceCompanyRow(row: Record<string, string>): Record<string, unknown> {
  return {
    name: emptyToUndefined(row.name),
    domain: emptyToUndefined(row.domain),
    industry: emptyToUndefined(row.industry),
    employeeCount: toNumber(row.employeeCount),
    companySize: emptyToUndefined(row.companySize),
    annualRevenue: toNumber(row.annualRevenue),
    foundedYear: toNumber(row.foundedYear),
    city: emptyToUndefined(row.city),
    state: emptyToUndefined(row.state),
    country: emptyToUndefined(row.country),
    linkedinUrl: emptyToUndefined(row.linkedinUrl),
    techStack: row.techStack
      ? row.techStack
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    fundingStage: emptyToUndefined(row.fundingStage),
    totalFundingUsd: toNumber(row.totalFundingUsd),
    description: emptyToUndefined(row.description),
  };
}

export function coerceContactRow(row: Record<string, string>): Record<string, unknown> {
  return {
    companyId: emptyToUndefined(row.companyId),
    firstName: emptyToUndefined(row.firstName),
    lastName: emptyToUndefined(row.lastName),
    title: emptyToUndefined(row.title),
    seniority: emptyToUndefined(row.seniority),
    department: emptyToUndefined(row.department),
    email: emptyToUndefined(row.email),
    phone: emptyToUndefined(row.phone),
    linkedinUrl: emptyToUndefined(row.linkedinUrl),
    city: emptyToUndefined(row.city),
    state: emptyToUndefined(row.state),
    country: emptyToUndefined(row.country),
  };
}

function issuesToMessages(issues: { path: (string | number)[]; message: string }[]): string[] {
  return issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
}

/** Validates one CSV row against `createCompanySchema`. `rowNumber` is 1-based and should account
 * for the header row (i.e. the first data row is row 2) so error messages match what a user sees
 * in a spreadsheet. */
export function validateCompanyRow(
  row: Record<string, string>,
  rowNumber: number,
): RowValidationResult<CreateCompanyInput> {
  const parsed = createCompanySchema.safeParse(coerceCompanyRow(row));
  if (!parsed.success) {
    return { row: rowNumber, valid: false, errors: issuesToMessages(parsed.error.issues) };
  }
  return { row: rowNumber, valid: true, data: parsed.data };
}

export function validateContactRow(
  row: Record<string, string>,
  rowNumber: number,
): RowValidationResult<CreateContactInput> {
  const parsed = createContactSchema.safeParse(coerceContactRow(row));
  if (!parsed.success) {
    return { row: rowNumber, valid: false, errors: issuesToMessages(parsed.error.issues) };
  }
  return { row: rowNumber, valid: true, data: parsed.data };
}
