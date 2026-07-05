import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import type { AuthContext } from '../../../common/request-context';
import { CompanyController } from './company.controller';
import type { CompanyService } from './company.service';
import type { SearchService } from '../lead-search/search.service';
import type { TagsService } from '../tags/tags.service';

const auth: AuthContext = {
  userId: 'user_1',
  email: 'a@b.com',
  organizationId: 'org_A',
  role: 'ADMIN',
  authMethod: 'session',
};

const company = {
  id: 'company_1',
  organizationId: 'org_A',
  name: 'Acme',
  annualRevenue: 1_000_000n,
  totalFundingUsd: null,
};

function makeController() {
  const companyService = {
    create: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const searchService = { searchCompanies: vi.fn() };
  const tagsService = { attachToCompany: vi.fn(), detachFromCompany: vi.fn() };
  const controller = new CompanyController(
    companyService as unknown as CompanyService,
    searchService as unknown as SearchService,
    tagsService as unknown as TagsService,
  );
  return { controller, companyService, searchService, tagsService };
}

describe('CompanyController', () => {
  it('search() delegates to SearchService.searchCompanies scoped by organization and serializes BigInt fields', async () => {
    const { controller, searchService } = makeController();
    searchService.searchCompanies.mockResolvedValue({ items: [company], total: 1, page: 1, pageSize: 25 });

    const result = await controller.search(auth, { page: 1, pageSize: 25, sortDir: 'desc' });

    expect(searchService.searchCompanies).toHaveBeenCalledWith('org_A', expect.any(Object));
    expect(result.items[0]).toMatchObject({ id: 'company_1', annualRevenue: 1_000_000 });
  });

  it('create() delegates to CompanyService.create scoped by organization', async () => {
    const { controller, companyService } = makeController();
    companyService.create.mockResolvedValue(company);

    await controller.create(auth, { name: 'Acme' });

    expect(companyService.create).toHaveBeenCalledWith('org_A', { name: 'Acme' });
  });

  it('findOne() delegates to CompanyService.findOne scoped by organization', async () => {
    const { controller, companyService } = makeController();
    companyService.findOne.mockResolvedValue(company);

    await controller.findOne(auth, 'company_1');

    expect(companyService.findOne).toHaveBeenCalledWith('org_A', 'company_1');
  });

  it('update() delegates to CompanyService.update scoped by organization', async () => {
    const { controller, companyService } = makeController();
    companyService.update.mockResolvedValue(company);

    await controller.update(auth, 'company_1', { name: 'New Name' });

    expect(companyService.update).toHaveBeenCalledWith('org_A', 'company_1', { name: 'New Name' });
  });

  it('remove() delegates to CompanyService.remove scoped by organization', async () => {
    const { controller, companyService } = makeController();

    await controller.remove(auth, 'company_1');

    expect(companyService.remove).toHaveBeenCalledWith('org_A', 'company_1');
  });

  it('attachTag()/detachTag() delegate to TagsService scoped by organization', async () => {
    const { controller, tagsService } = makeController();

    await controller.attachTag(auth, 'company_1', 'tag_1');
    await controller.detachTag(auth, 'company_1', 'tag_1');

    expect(tagsService.attachToCompany).toHaveBeenCalledWith('org_A', 'company_1', 'tag_1');
    expect(tagsService.detachFromCompany).toHaveBeenCalledWith('org_A', 'company_1', 'tag_1');
  });

  it('requires REP+ for create/update/tag mutations and MANAGER+ for delete', () => {
    expect(Reflect.getMetadata(ROLES_KEY, CompanyController.prototype.create)).toEqual(['REP']);
    expect(Reflect.getMetadata(ROLES_KEY, CompanyController.prototype.update)).toEqual(['REP']);
    expect(Reflect.getMetadata(ROLES_KEY, CompanyController.prototype.attachTag)).toEqual(['REP']);
    expect(Reflect.getMetadata(ROLES_KEY, CompanyController.prototype.detachTag)).toEqual(['REP']);
    expect(Reflect.getMetadata(ROLES_KEY, CompanyController.prototype.remove)).toEqual(['MANAGER']);
    expect(Reflect.getMetadata(ROLES_KEY, CompanyController.prototype.search)).toBeUndefined();
  });
});
