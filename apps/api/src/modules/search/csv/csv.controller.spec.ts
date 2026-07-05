import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import type { AuthContext } from '../../../common/request-context';
import { CsvController } from './csv.controller';
import type { CsvImportService } from './csv-import.service';
import type { CsvExportService } from './csv-export.service';

const auth: AuthContext = {
  userId: 'user_1',
  email: 'a@b.com',
  organizationId: 'org_A',
  role: 'ADMIN',
  authMethod: 'session',
};

function makeController() {
  const csvImportService = { importCompanies: vi.fn(), importContacts: vi.fn() };
  const csvExportService = { exportCompanies: vi.fn(), exportContacts: vi.fn() };
  const controller = new CsvController(
    csvImportService as unknown as CsvImportService,
    csvExportService as unknown as CsvExportService,
  );
  return { controller, csvImportService, csvExportService };
}

function makeFile(originalname = 'companies.csv') {
  return { originalname, mimetype: 'text/csv', size: 10, buffer: Buffer.from('name\nAcme\n') };
}

function makeResMock() {
  return { setHeader: vi.fn(), send: vi.fn() };
}

describe('CsvController', () => {
  it('importCompanies() delegates to CsvImportService.importCompanies scoped by organization', async () => {
    const { controller, csvImportService } = makeController();
    csvImportService.importCompanies.mockResolvedValue({ id: 'csv_1' });
    const file = makeFile();

    await controller.importCompanies(auth, file);

    expect(csvImportService.importCompanies).toHaveBeenCalledWith('org_A', file.originalname, file.buffer);
  });

  it('importCompanies() throws BadRequestException when no file is provided', () => {
    const { controller, csvImportService } = makeController();

    expect(() => controller.importCompanies(auth, undefined)).toThrow(BadRequestException);
    expect(csvImportService.importCompanies).not.toHaveBeenCalled();
  });

  it('importContacts() delegates to CsvImportService.importContacts scoped by organization', async () => {
    const { controller, csvImportService } = makeController();
    csvImportService.importContacts.mockResolvedValue({ id: 'csv_2' });
    const file = makeFile('contacts.csv');

    await controller.importContacts(auth, file);

    expect(csvImportService.importContacts).toHaveBeenCalledWith('org_A', file.originalname, file.buffer);
  });

  it('importContacts() throws BadRequestException when no file is provided', () => {
    const { controller, csvImportService } = makeController();

    expect(() => controller.importContacts(auth, undefined)).toThrow(BadRequestException);
    expect(csvImportService.importContacts).not.toHaveBeenCalled();
  });

  it('exportCompanies() sets CSV headers and sends the generated body', async () => {
    const { controller, csvExportService } = makeController();
    csvExportService.exportCompanies.mockResolvedValue('id,name\n1,Acme\n');
    const res = makeResMock();

    await controller.exportCompanies(auth, { page: 1, pageSize: 25, sortDir: 'desc' }, res as never);

    expect(csvExportService.exportCompanies).toHaveBeenCalledWith('org_A', expect.any(Object));
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="companies.csv"',
    );
    expect(res.send).toHaveBeenCalledWith('id,name\n1,Acme\n');
  });

  it('exportContacts() sets CSV headers and sends the generated body', async () => {
    const { controller, csvExportService } = makeController();
    csvExportService.exportContacts.mockResolvedValue('id,name\n1,Jane\n');
    const res = makeResMock();

    await controller.exportContacts(auth, { page: 1, pageSize: 25, sortDir: 'desc' }, res as never);

    expect(csvExportService.exportContacts).toHaveBeenCalledWith('org_A', expect.any(Object));
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="contacts.csv"',
    );
    expect(res.send).toHaveBeenCalledWith('id,name\n1,Jane\n');
  });

  it('requires REP+ for the import endpoints', () => {
    expect(Reflect.getMetadata(ROLES_KEY, CsvController.prototype.importCompanies)).toEqual(['REP']);
    expect(Reflect.getMetadata(ROLES_KEY, CsvController.prototype.importContacts)).toEqual(['REP']);
    expect(Reflect.getMetadata(ROLES_KEY, CsvController.prototype.exportCompanies)).toBeUndefined();
    expect(Reflect.getMetadata(ROLES_KEY, CsvController.prototype.exportContacts)).toBeUndefined();
  });
});
