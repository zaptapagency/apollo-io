import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import type { AuthContext } from '../../../common/request-context';
import { ApiKeysController } from './api-keys.controller';
import type { ApiKeysService } from './api-keys.service';

const auth: AuthContext = {
  userId: 'user_1',
  email: 'a@b.com',
  organizationId: 'org_A',
  role: 'ADMIN',
  authMethod: 'session',
};

function makeController() {
  const service = { create: vi.fn(), list: vi.fn(), revoke: vi.fn() };
  const controller = new ApiKeysController(service as unknown as ApiKeysService);
  return { controller, service };
}

describe('ApiKeysController', () => {
  it('create() forwards organizationId, actor userId, and the validated body', () => {
    const { controller, service } = makeController();
    controller.create(auth, { name: 'CI key', scopes: [], rateLimitPerMinute: 120 });
    expect(service.create).toHaveBeenCalledWith('org_A', 'user_1', {
      name: 'CI key',
      scopes: [],
      rateLimitPerMinute: 120,
    });
  });

  it('list() scopes to the caller organization only', () => {
    const { controller, service } = makeController();
    controller.list(auth);
    expect(service.list).toHaveBeenCalledWith('org_A');
  });

  it('revoke() forwards the target key id', async () => {
    const { controller, service } = makeController();
    await controller.revoke(auth, 'key_1');
    expect(service.revoke).toHaveBeenCalledWith('org_A', 'user_1', 'key_1');
  });

  it('requires ADMIN+ to create or revoke, but not to list', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ApiKeysController.prototype.create)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata(ROLES_KEY, ApiKeysController.prototype.revoke)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata(ROLES_KEY, ApiKeysController.prototype.list)).toBeUndefined();
  });
});
