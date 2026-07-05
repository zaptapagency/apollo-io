import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import type { AuthContext } from '../../../common/request-context';
import { MembersController } from './members.controller';
import type { MembersService } from './members.service';

const auth: AuthContext = {
  userId: 'user_1',
  email: 'a@b.com',
  organizationId: 'org_A',
  role: 'ADMIN',
  authMethod: 'session',
};

function makeController() {
  const service = {
    list: vi.fn(),
    invite: vi.fn(),
    updateRole: vi.fn(),
    remove: vi.fn(),
  };
  const controller = new MembersController(service as unknown as MembersService);
  return { controller, service };
}

describe('MembersController', () => {
  it('list() delegates to the service using only the caller organizationId', () => {
    const { controller, service } = makeController();
    controller.list(auth);
    expect(service.list).toHaveBeenCalledWith('org_A');
  });

  it('invite() forwards organizationId, actor userId, and the validated body', () => {
    const { controller, service } = makeController();
    controller.invite(auth, { email: 'new@b.com', role: 'REP' });
    expect(service.invite).toHaveBeenCalledWith('org_A', 'user_1', { email: 'new@b.com', role: 'REP' });
  });

  it('updateRole() forwards the target userId param separately from the caller', () => {
    const { controller, service } = makeController();
    controller.updateRole(auth, 'target_user', { role: 'MANAGER' });
    expect(service.updateRole).toHaveBeenCalledWith('org_A', 'user_1', 'target_user', { role: 'MANAGER' });
  });

  it('remove() forwards the target userId param', async () => {
    const { controller, service } = makeController();
    await controller.remove(auth, 'target_user');
    expect(service.remove).toHaveBeenCalledWith('org_A', 'user_1', 'target_user');
  });

  it('requires ADMIN+ for invite/updateRole/remove but not for list (RBAC declaration)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, MembersController.prototype.invite)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata(ROLES_KEY, MembersController.prototype.updateRole)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata(ROLES_KEY, MembersController.prototype.remove)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata(ROLES_KEY, MembersController.prototype.list)).toBeUndefined();
  });
});
