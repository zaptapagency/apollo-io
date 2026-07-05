import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prospect/db';
import type { PaginatedResult, Pagination } from '@prospect/shared';
import { PrismaService } from '../../../prisma/prisma.service';

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  actorUserId: string | null;
  actorApiKeyId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}

/**
 * Append-only audit trail for security-sensitive organization events (member/role changes,
 * API key lifecycle, subscription changes). Always scoped by `organizationId` — never queried
 * or written without it.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    organizationId: string,
    actor: { userId?: string; apiKeyId?: string },
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.client.auditLog.create({
      data: {
        organizationId,
        actorUserId: actor.userId ?? null,
        actorApiKeyId: actor.apiKeyId ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async list(organizationId: string, pagination: Pagination): Promise<PaginatedResult<AuditLogEntry>> {
    const { page, pageSize } = pagination;
    const where = { organizationId };
    const [items, total] = await Promise.all([
      this.prisma.client.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}
