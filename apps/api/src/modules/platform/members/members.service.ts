import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { InviteMemberInput, OrgRole, UpdateMemberRoleInput } from '@prospect/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

/**
 * Org membership management. Every query filters by `organizationId` so a caller can never
 * read/mutate a membership belonging to a different organization, even by guessing a userId.
 */
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(organizationId: string) {
    return this.prisma.client.membership.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async invite(organizationId: string, actorUserId: string, input: InviteMemberInput) {
    let user = await this.prisma.client.user.findUnique({ where: { email: input.email } });
    if (!user) {
      user = await this.prisma.client.user.create({
        data: { email: input.email, name: input.email.split('@')[0] ?? input.email },
      });
    }

    const existingMembership = await this.prisma.client.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (existingMembership) {
      throw new ConflictException('This user is already a member of the organization');
    }

    const membership = await this.prisma.client.membership.create({
      data: { organizationId, userId: user.id, role: input.role },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });

    await this.auditLog.record(
      organizationId,
      { userId: actorUserId },
      'member.invited',
      'Membership',
      membership.id,
      { email: input.email, role: input.role },
    );

    return membership;
  }

  async updateRole(
    organizationId: string,
    actorUserId: string,
    targetUserId: string,
    input: UpdateMemberRoleInput,
  ) {
    const membership = await this.prisma.client.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
    });
    if (!membership) throw new NotFoundException('Member not found in this organization');

    if (membership.role === 'OWNER' && input.role !== 'OWNER') {
      await this.assertNotLastOwner(organizationId);
    }

    const updated = await this.prisma.client.membership.update({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
      data: { role: input.role },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });

    await this.auditLog.record(
      organizationId,
      { userId: actorUserId },
      'member.role_changed',
      'Membership',
      updated.id,
      { targetUserId, fromRole: membership.role, toRole: input.role },
    );

    return updated;
  }

  async remove(organizationId: string, actorUserId: string, targetUserId: string): Promise<void> {
    const membership = await this.prisma.client.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
    });
    if (!membership) throw new NotFoundException('Member not found in this organization');

    if (membership.role === 'OWNER') {
      await this.assertNotLastOwner(organizationId);
    }

    await this.prisma.client.membership.delete({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
    });

    await this.auditLog.record(
      organizationId,
      { userId: actorUserId },
      'member.removed',
      'Membership',
      membership.id,
      { targetUserId, role: membership.role },
    );
  }

  /** Throws unless there is more than one OWNER membership left in the organization. */
  private async assertNotLastOwner(organizationId: string): Promise<void> {
    const ownerCount = await this.prisma.client.membership.count({
      where: { organizationId, role: 'OWNER' as OrgRole },
    });
    if (ownerCount <= 1) {
      throw new BadRequestException('Cannot remove or demote the last owner of an organization');
    }
  }
}
