import type { Company, Contact } from '@prospect/db';

/**
 * Companies carry `BigInt` columns (`annualRevenue`, `totalFundingUsd`) so Postgres can store
 * arbitrarily large monetary values. `BigInt` cannot be `JSON.stringify`'d by Express's default
 * serializer, so every HTTP-facing response must go through this mapper before being returned
 * from a controller. Internally (services, where-builders, tests) we keep working with the raw
 * Prisma `Company` type — only the controller boundary needs the JSON-safe shape.
 */
export interface CompanyResponse extends Omit<Company, 'annualRevenue' | 'totalFundingUsd'> {
  annualRevenue: number | null;
  totalFundingUsd: number | null;
}

export function toCompanyResponse(company: Company): CompanyResponse {
  return {
    ...company,
    annualRevenue: company.annualRevenue === null ? null : Number(company.annualRevenue),
    totalFundingUsd: company.totalFundingUsd === null ? null : Number(company.totalFundingUsd),
  };
}

export function toCompanyResponseList(companies: Company[]): CompanyResponse[] {
  return companies.map(toCompanyResponse);
}

/** Contacts have no BigInt columns today, but this mirrors the company mapper for symmetry
 * and gives us a single seam to extend if that ever changes (e.g. a future `dealValue` rollup). */
export function toContactResponse<T extends Contact>(contact: T): T {
  return contact;
}
