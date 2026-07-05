import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import type { AuthContext } from '../../../common/request-context';
import { SavedSearchesController } from './saved-searches.controller';
import type { SavedSearchesService } from './saved-searches.service';

const auth: AuthContext = {
  userId: 'user_1',
  email: 'a@b.com',
  organizationId: 'org_A',
  role: 'ADMIN',
  authMethod: 'session',
};

function makeController() {
  const savedSearchesService = {
    list: vi.fn(),
    create: vi.fn(),
    run: vi.fn(),
    remove: vi.fn(),
  };
  const controller = new SavedSearchesController(savedSearchesService as unknown as SavedSearchesService);
  return { controller, savedSearchesService };
}

describe('SavedSearchesController', () => {
  it('list() delegates to SavedSearchesService.list scoped by organization', () => {
    const { controller, savedSearchesService } = makeController();

    controller.list(auth);

    expect(savedSearchesService.list).toHaveBeenCalledWith('org_A');
  });

  it('create() delegates to SavedSearchesService.create scoped by organization', () => {
    const { controller, savedSearchesService } = makeController();
    const body = { name: 'VPs in SaaS', entity: 'CONTACT' as const, filters: {} };

    controller.create(auth, body);

    expect(savedSearchesService.create).toHaveBeenCalledWith('org_A', body);
  });

  it('run() delegates to SavedSearchesService.run scoped by organization', () => {
    const { controller, savedSearchesService } = makeController();

    controller.run(auth, 'ss_1');

    expect(savedSearchesService.run).toHaveBeenCalledWith('org_A', 'ss_1');
  });

  it('remove() delegates to SavedSearchesService.remove scoped by organization', async () => {
    const { controller, savedSearchesService } = makeController();

    await controller.remove(auth, 'ss_1');

    expect(savedSearchesService.remove).toHaveBeenCalledWith('org_A', 'ss_1');
  });

  it('requires REP+ for create/remove but not for list/run', () => {
    expect(Reflect.getMetadata(ROLES_KEY, SavedSearchesController.prototype.create)).toEqual(['REP']);
    expect(Reflect.getMetadata(ROLES_KEY, SavedSearchesController.prototype.remove)).toEqual(['REP']);
    expect(Reflect.getMetadata(ROLES_KEY, SavedSearchesController.prototype.list)).toBeUndefined();
    expect(Reflect.getMetadata(ROLES_KEY, SavedSearchesController.prototype.run)).toBeUndefined();
  });
});
