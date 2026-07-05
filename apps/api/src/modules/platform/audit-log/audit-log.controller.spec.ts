import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import type { AuthContext } from '../../../common/request-context';
import { AuditLogController } from './audit-log.controller';
import type { AuditLogService } from './audit-log.service';

const auth: AuthContext = {
  userId: 'user_1',
  email: 'a@b.com',
  organizationId: 'org_A',
  role: 'ADMIN',
  authMethod: 'session',
};

describe('AuditLogController', () => {
  it('list() forwards the caller organizationId and pagination', () => {
    const service = { list: vi.fn() };
    const controller = new AuditLogController(service as unknown as AuditLogService);

    controller.list(auth, { page: 2, pageSize: 50 });

    expect(service.list).toHaveBeenCalledWith('org_A', { page: 2, pageSize: 50 });
  });

  it('requires ADMIN+ (audit log is a security-sensitive endpoint)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AuditLogController.prototype.list)).toEqual(['ADMIN']);
  });
});
