import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { CsvImport } from '@prospect/db';
import { leadSearchSchema } from '@prospect/shared';
import type { LeadSearchQuery } from '@prospect/shared';
import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../../common/request-context';
import { CsvImportService } from './csv-import.service';
import { CsvExportService } from './csv-export.service';

/** Matches the subset of `Express.Multer.File` this controller actually uses. Declared locally
 * (rather than depending on `@types/multer`'s global `Express.Multer` augmentation, which isn't
 * installed in this workspace) since `multer`'s own package ships no bundled type declarations. */
export interface UploadedCsvFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('search/csv')
@Controller('search')
export class CsvController {
  constructor(
    private readonly csvImportService: CsvImportService,
    private readonly csvExportService: CsvExportService,
  ) {}

  @Post('csv-imports/companies')
  @Roles('REP')
  @UseInterceptors(FileInterceptor('file'))
  importCompanies(
    @CurrentAuth() auth: AuthContext,
    @UploadedFile() file: UploadedCsvFile | undefined,
  ): Promise<CsvImport> {
    if (!file) throw new BadRequestException('A "file" multipart field is required');
    return this.csvImportService.importCompanies(auth.organizationId, file.originalname, file.buffer);
  }

  @Post('csv-imports/contacts')
  @Roles('REP')
  @UseInterceptors(FileInterceptor('file'))
  importContacts(
    @CurrentAuth() auth: AuthContext,
    @UploadedFile() file: UploadedCsvFile | undefined,
  ): Promise<CsvImport> {
    if (!file) throw new BadRequestException('A "file" multipart field is required');
    return this.csvImportService.importContacts(auth.organizationId, file.originalname, file.buffer);
  }

  @Get('csv-exports/companies')
  async exportCompanies(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(leadSearchSchema)) query: LeadSearchQuery,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.csvExportService.exportCompanies(auth.organizationId, query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="companies.csv"');
    res.send(csv);
  }

  @Get('csv-exports/contacts')
  async exportContacts(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(leadSearchSchema)) query: LeadSearchQuery,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.csvExportService.exportContacts(auth.organizationId, query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
    res.send(csv);
  }
}
