import type { Prisma } from '@prospect/db';

/**
 * Sortable columns are allowlisted (rather than passing `sortBy` straight through to Prisma) so
 * a client can never probe for the existence of an arbitrary column name and so `orderBy` always
 * resolves to a real, indexed-friendly column.
 */
const COMPANY_SORT_FIELDS: Record<string, keyof Prisma.CompanyOrderByWithRelationInput> = {
  name: 'name',
  employeeCount: 'employeeCount',
  annualRevenue: 'annualRevenue',
  foundedYear: 'foundedYear',
  totalFundingUsd: 'totalFundingUsd',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

const CONTACT_SORT_FIELDS: Record<string, keyof Prisma.ContactOrderByWithRelationInput> = {
  firstName: 'firstName',
  lastName: 'lastName',
  title: 'title',
  emailScore: 'emailScore',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

export function resolveCompanySort(
  sortBy: string | undefined,
  sortDir: 'asc' | 'desc',
): Prisma.CompanyOrderByWithRelationInput {
  const field = (sortBy && COMPANY_SORT_FIELDS[sortBy]) || 'createdAt';
  return { [field]: sortDir };
}

export function resolveContactSort(
  sortBy: string | undefined,
  sortDir: 'asc' | 'desc',
): Prisma.ContactOrderByWithRelationInput {
  const field = (sortBy && CONTACT_SORT_FIELDS[sortBy]) || 'createdAt';
  return { [field]: sortDir };
}
