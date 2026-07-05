import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import type { AuthContext } from '../../../common/request-context';
import { WebhooksController } from './webhooks.controller';
import type { WebhooksService } from './webhooks.service';

const auth: AuthContext = {
  userId: 'user_1',
  email: 'a@b.com',
  organizationId: 'org_A',
  role: 'ADMIN',
  authMethod: 'session',
};

function makeController() {
  const service = { create: vi.fn(), list: vi.fn(), remove: vi.fn() };
  const controller = new WebhooksController(service as unknown as WebhooksService);
  return { controller, service };
}

describe('WebhooksController', () => {
  it('create() forwards organizationId and the validated body', () => {
    const { controller, service } = makeController();
    controller.create(auth, { url: 'https://example.com/hook', events: ['contact.created'] });
    expect(service.create).toHaveBeenCalledWith('org_A', {
      url: 'https://example.com/hook',
      events: ['contact.created'],
    });
  });

  it('list() scopes to the caller organization only', () => {
    const { controller, service } = makeController();
    controller.list(auth);
    expect(service.list).toHaveBeenCalledWith('org_A');
  });

  it('remove() forwards the target endpoint id', async () => {
    const { controller, service } = makeController();
    await controller.remove(auth, 'wh_1');
    expect(service.remove).toHaveBeenCalledWith('org_A', 'wh_1');
  });

  it('requires ADMIN+ to create or remove endpoints, but not to list', () => {
    expect(Reflect.getMetadata(ROLES_KEY, WebhooksController.prototype.create)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata(ROLES_KEY, WebhooksController.prototype.remove)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata(ROLES_KEY, WebhooksController.prototype.list)).toBeUndefined();
  });
});
