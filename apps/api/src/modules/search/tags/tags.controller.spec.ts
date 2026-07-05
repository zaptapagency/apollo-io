import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import type { AuthContext } from '../../../common/request-context';
import { TagsController } from './tags.controller';
import type { TagsService } from './tags.service';

const auth: AuthContext = {
  userId: 'user_1',
  email: 'a@b.com',
  organizationId: 'org_A',
  role: 'ADMIN',
  authMethod: 'session',
};

function makeController() {
  const tagsService = { list: vi.fn(), create: vi.fn() };
  const controller = new TagsController(tagsService as unknown as TagsService);
  return { controller, tagsService };
}

describe('TagsController', () => {
  it('list() delegates to TagsService.list scoped by organization', () => {
    const { controller, tagsService } = makeController();

    controller.list(auth);

    expect(tagsService.list).toHaveBeenCalledWith('org_A');
  });

  it('create() delegates to TagsService.create scoped by organization', () => {
    const { controller, tagsService } = makeController();

    controller.create(auth, { name: 'Hot Lead', color: '#ff0000' });

    expect(tagsService.create).toHaveBeenCalledWith('org_A', { name: 'Hot Lead', color: '#ff0000' });
  });

  it('requires REP+ for create but not for list', () => {
    expect(Reflect.getMetadata(ROLES_KEY, TagsController.prototype.create)).toEqual(['REP']);
    expect(Reflect.getMetadata(ROLES_KEY, TagsController.prototype.list)).toBeUndefined();
  });
});
