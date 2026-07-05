import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import type { PrismaService } from '../../../prisma/prisma.service';

function makePrismaMock() {
  return { client: { organization: { findUnique: vi.fn() } } };
}

describe('OrganizationsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: OrganizationsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new OrganizationsService(prisma as unknown as PrismaService);
  });

  it('looks up the organization by the id from the auth context only', async () => {
    prisma.client.organization.findUnique.mockResolvedValue({ id: 'org_A', name: 'Acme' });

    const result = await service.getMine('org_A');

    expect(result).toEqual({ id: 'org_A', name: 'Acme' });
    expect(prisma.client.organization.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'org_A' } }),
    );
  });

  it('throws NotFoundException when the organization no longer exists', async () => {
    prisma.client.organization.findUnique.mockResolvedValue(null);

    await expect(service.getMine('org_missing')).rejects.toThrow(NotFoundException);
  });
});
