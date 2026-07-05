import { Module } from '@nestjs/common';
import { CompanyController } from './companies/company.controller';
import { CompanyService } from './companies/company.service';
import { ContactController } from './contacts/contact.controller';
import { ContactService } from './contacts/contact.service';
import { SearchService } from './lead-search/search.service';
import { TagsController } from './tags/tags.controller';
import { TagsService } from './tags/tags.service';
import { ListsController } from './lists/lists.controller';
import { ListsService } from './lists/lists.service';
import { SavedSearchesController } from './saved-searches/saved-searches.controller';
import { SavedSearchesService } from './saved-searches/saved-searches.service';
import { CsvController } from './csv/csv.controller';
import { CsvImportService } from './csv/csv-import.service';
import { CsvExportService } from './csv/csv-export.service';
import { OpenSearchIndexerService } from './opensearch/opensearch-indexer.service';

// Workstream A: company/contact CRUD, lead search (Postgres-backed today, OpenSearch-indexed
// on every write for a future cutover — see DECISIONS.md), saved searches, lists, tags, CSV
// import/export.
@Module({
  controllers: [
    CompanyController,
    ContactController,
    TagsController,
    ListsController,
    SavedSearchesController,
    CsvController,
  ],
  providers: [
    CompanyService,
    ContactService,
    SearchService,
    TagsService,
    ListsService,
    SavedSearchesService,
    CsvImportService,
    CsvExportService,
    OpenSearchIndexerService,
  ],
  exports: [SearchService],
})
export class SearchModule {}
