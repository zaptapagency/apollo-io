import { describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../../../common/request-context';
import { OrganizationsController } from './organizations.controller';
import type { OrganizationsService } from './organizations.service';

describe('OrganizationsController', () => {
  it('getMine() resolves the organization from the auth context, never a client-supplied id', () => {
    const service = { getMine: vi.fn() };
    const controller = new OrganizationsController(service as unknown as OrganizationsService);
    const auth: AuthContext = {
      userId: 'user_1',
      email: 'a@b.com',
      organizationId: 'org_A',
      role: 'REP',
      authMethod: 'session',
    };

    controller.getMine(auth);

    expect(service.getMine).toHaveBeenCalledWith('org_A');
  });
});
