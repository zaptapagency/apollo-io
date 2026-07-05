import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prospect/db';
import { CsvImportService } from './csv-import.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyService } from '../companies/company.service';
import type { ContactService } from '../contacts/contact.service';

function makePrismaMock() {
  return {
    client: {
      csvImport: { create: vi.fn(), update: vi.fn() },
    },
  };
}

function makeCompanyServiceMock() {
  return { create: vi.fn() };
}

function makeContactServiceMock() {
  return { create: vi.fn() };
}

describe('CsvImportService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let companyService: ReturnType<typeof makeCompanyServiceMock>;
  let contactService: ReturnType<typeof makeContactServiceMock>;
  let service: CsvImportService;

  beforeEach(() => {
    prisma = makePrismaMock();
    companyService = makeCompanyServiceMock();
    contactService = makeContactServiceMock();
    service = new CsvImportService(
      prisma as unknown as PrismaService,
      companyService as unknown as CompanyService,
      contactService as unknown as ContactService,
    );
    prisma.client.csvImport.create.mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'csv_1', ...args.data }),
    );
    prisma.client.csvImport.update.mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'csv_1', ...args.data }),
    );
  });

  describe('importCompanies', () => {
    it('creates a valid row via CompanyService.create and records it as processed', async () => {
      companyService.create.mockResolvedValue({ id: 'company_1' });
      const buffer = Buffer.from('name,domain\nAcme,acme.com\n');

      const result = await service.importCompanies('org_A', 'companies.csv', buffer);

      expect(companyService.create).toHaveBeenCalledWith(
        'org_A',
        expect.objectContaining({ name: 'Acme', domain: 'acme.com' }),
      );
      expect(result.status).toBe('COMPLETED');
      expect(result.processedRows).toBe(1);
      expect(result.errorRows).toBe(0);
      expect(result.errors).toEqual(Prisma.JsonNull);
    });

    it('collects a per-row validation error without creating the row, using a 1-based row number', async () => {
      const buffer = Buffer.from('name,domain\n,acme.com\n');

      const result = await service.importCompanies('org_A', 'companies.csv', buffer);

      expect(companyService.create).not.toHaveBeenCalled();
      expect(result.errorRows).toBe(1);
      expect(result.processedRows).toBe(0);
      expect(result.status).toBe('FAILED');
      expect(result.errors).toEqual([
        expect.objectContaining({ row: 2 }),
      ]);
    });

    it('continues processing subsequent rows after a row-level create failure', async () => {
      companyService.create
        .mockRejectedValueOnce(new Error('duplicate domain'))
        .mockResolvedValueOnce({ id: 'company_2' });
      const buffer = Buffer.from('name,domain\nAcme,acme.com\nBeta,beta.com\n');

      const result = await service.importCompanies('org_A', 'companies.csv', buffer);

      expect(companyService.create).toHaveBeenCalledTimes(2);
      expect(result.processedRows).toBe(1);
      expect(result.errorRows).toBe(1);
      expect(result.status).toBe('COMPLETED');
    });

    it('handles a totally malformed CSV buffer by recording a FAILED import with a parse error', async () => {
      // An unterminated quoted field makes csv-parse throw synchronously.
      const buffer = Buffer.from('name,domain\n"Acme,acme.com\n');

      const result = await service.importCompanies('org_A', 'companies.csv', buffer);

      expect(companyService.create).not.toHaveBeenCalled();
      expect(result.status).toBe('FAILED');
      expect(result.totalRows).toBe(0);
      expect(result.errorRows).toBe(1);
    });
  });

  describe('importContacts', () => {
    it('creates a valid row via ContactService.create', async () => {
      contactService.create.mockResolvedValue({ id: 'contact_1' });
      const buffer = Buffer.from('firstName,lastName\nJane,Doe\n');

      const result = await service.importContacts('org_A', 'contacts.csv', buffer);

      expect(contactService.create).toHaveBeenCalledWith(
        'org_A',
        expect.objectContaining({ firstName: 'Jane', lastName: 'Doe' }),
      );
      expect(result.processedRows).toBe(1);
    });
  });
});
