import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { Prisma } from '@prospect/db';
import type { CsvImport } from '@prospect/db';
import { PrismaService } from '../../../prisma/prisma.service';
import { CompanyService } from '../companies/company.service';
import { ContactService } from '../contacts/contact.service';
import {
  validateCompanyRow,
  validateContactRow,
  type RowValidationResult,
} from './csv-row-validation';

interface RowError {
  row: number;
  errors: string[];
}

@Injectable()
export class CsvImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyService: CompanyService,
    private readonly contactService: ContactService,
  ) {}

  async importCompanies(
    organizationId: string,
    fileName: string,
    buffer: Buffer,
  ): Promise<CsvImport> {
    return this.runImport(
      organizationId,
      'COMPANY',
      fileName,
      buffer,
      validateCompanyRow,
      (data) => this.companyService.create(organizationId, data),
    );
  }

  async importContacts(
    organizationId: string,
    fileName: string,
    buffer: Buffer,
  ): Promise<CsvImport> {
    return this.runImport(
      organizationId,
      'CONTACT',
      fileName,
      buffer,
      validateContactRow,
      (data) => this.contactService.create(organizationId, data),
    );
  }

  private async runImport<TInput>(
    organizationId: string,
    entity: 'COMPANY' | 'CONTACT',
    fileName: string,
    buffer: Buffer,
    validateRow: (row: Record<string, string>, rowNumber: number) => RowValidationResult<TInput>,
    createRow: (input: TInput) => Promise<unknown>,
  ): Promise<CsvImport> {
    let records: Record<string, string>[];
    try {
      records = parse(buffer, { columns: true, skip_empty_lines: true, trim: true });
    } catch (err) {
      return this.prisma.client.csvImport.create({
        data: {
          organizationId,
          entity,
          fileName,
          status: 'FAILED',
          totalRows: 0,
          processedRows: 0,
          errorRows: 1,
          errors: [
            { row: 0, errors: [`Failed to parse CSV: ${err instanceof Error ? err.message : String(err)}`] },
          ] as unknown as Prisma.InputJsonValue,
        },
      });
    }

    const csvImport = await this.prisma.client.csvImport.create({
      data: {
        organizationId,
        entity,
        fileName,
        status: 'PROCESSING',
        totalRows: records.length,
      },
    });

    const rowErrors: RowError[] = [];
    let processed = 0;

    for (let i = 0; i < records.length; i += 1) {
      const rowNumber = i + 2; // account for the header row, 1-indexed
      const record = records[i];
      if (!record) continue;
      const result = validateRow(record, rowNumber);
      if (!result.valid || !result.data) {
        rowErrors.push({ row: rowNumber, errors: result.errors ?? ['Unknown validation error'] });
        continue;
      }
      try {
        await createRow(result.data);
        processed += 1;
      } catch (err) {
        rowErrors.push({
          row: rowNumber,
          errors: [err instanceof Error ? err.message : 'Unknown error creating row'],
        });
      }
    }

    return this.prisma.client.csvImport.update({
      where: { id: csvImport.id },
      data: {
        status: records.length > 0 && processed === 0 ? 'FAILED' : 'COMPLETED',
        processedRows: processed,
        errorRows: rowErrors.length,
        errors: rowErrors.length ? (rowErrors as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }
}
