import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import type { AuthContext } from '../../../common/request-context';
import { ListsController } from './lists.controller';
import type { ListsService } from './lists.service';

const auth: AuthContext = {
  userId: 'user_1',
  email: 'a@b.com',
  organizationId: 'org_A',
  role: 'ADMIN',
  authMethod: 'session',
};

function makeController() {
  const listsService = {
    list: vi.fn(),
    create: vi.fn(),
    addMembers: vi.fn(),
    listMembers: vi.fn(),
    removeMember: vi.fn(),
  };
  const controller = new ListsController(listsService as unknown as ListsService);
  return { controller, listsService };
}

describe('ListsController', () => {
  it('list() delegates to ListsService.list scoped by organization', () => {
    const { controller, listsService } = makeController();

    controller.list(auth);

    expect(listsService.list).toHaveBeenCalledWith('org_A');
  });

  it('create() delegates to ListsService.create scoped by organization', () => {
    const { controller, listsService } = makeController();

    controller.create(auth, { name: 'ABM Targets', type: 'COMPANY' });

    expect(listsService.create).toHaveBeenCalledWith('org_A', { name: 'ABM Targets', type: 'COMPANY' });
  });

  it('addMembers() delegates to ListsService.addMembers scoped by organization', () => {
    const { controller, listsService } = makeController();

    controller.addMembers(auth, { listId: 'list_1', companyIds: ['company_1'] });

    expect(listsService.addMembers).toHaveBeenCalledWith('org_A', {
      listId: 'list_1',
      companyIds: ['company_1'],
    });
  });

  it('listMembers() delegates to ListsService.listMembers scoped by organization', () => {
    const { controller, listsService } = makeController();

    controller.listMembers(auth, 'list_1');

    expect(listsService.listMembers).toHaveBeenCalledWith('org_A', 'list_1');
  });

  it('removeMember() delegates to ListsService.removeMember scoped by organization', async () => {
    const { controller, listsService } = makeController();

    await controller.removeMember(auth, 'list_1', 'membership_1');

    expect(listsService.removeMember).toHaveBeenCalledWith('org_A', 'list_1', 'membership_1');
  });

  it('requires REP+ for create/addMembers/removeMember but not for list/listMembers', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ListsController.prototype.create)).toEqual(['REP']);
    expect(Reflect.getMetadata(ROLES_KEY, ListsController.prototype.addMembers)).toEqual(['REP']);
    expect(Reflect.getMetadata(ROLES_KEY, ListsController.prototype.removeMember)).toEqual(['REP']);
    expect(Reflect.getMetadata(ROLES_KEY, ListsController.prototype.list)).toBeUndefined();
    expect(Reflect.getMetadata(ROLES_KEY, ListsController.prototype.listMembers)).toBeUndefined();
  });
});
