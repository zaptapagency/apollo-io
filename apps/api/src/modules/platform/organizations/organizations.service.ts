import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the organization the caller is currently scoped to (never a client-supplied id). */
  async getMine(organizationId: string) {
    const organization = await this.prisma.client.organization.findUnique({
      where: { id: organizationId },
      include: { subscription: true },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    return organization;
  }
}
