import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateApiKeyInput } from '@prospect/shared';
import { hashToken } from '../../../common/guards/auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { generateApiKey } from '../common/tokens.util';
import { AuditLogService } from '../audit-log/audit-log.service';

export interface CreatedApiKey {
  id: string;
  name: string;
  key: string; // raw key — returned exactly once, never persisted or retrievable again
  keyPrefix: string;
  scopes: string[];
  rateLimitPerMinute: number;
  createdAt: Date;
}

/**
 * API key lifecycle. Keys are hashed at rest with the exact same `hashToken` (SHA-256) function
 * `AuthGuard` uses to authenticate incoming `psk_...` bearer tokens, so a key minted here is
 * guaranteed to authenticate correctly end to end.
 */
@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(
    organizationId: string,
    actorUserId: string,
    input: CreateApiKeyInput,
  ): Promise<CreatedApiKey> {
    const { raw, prefix } = generateApiKey();
    const keyHash = hashToken(raw);

    const created = await this.prisma.client.apiKey.create({
      data: {
        organizationId,
        name: input.name,
        keyPrefix: prefix,
        keyHash,
        scopes: input.scopes,
        rateLimitPerMinute: input.rateLimitPerMinute,
      },
    });

    await this.auditLog.record(
      organizationId,
      { userId: actorUserId },
      'api_key.created',
      'ApiKey',
      created.id,
      { name: input.name, keyPrefix: prefix },
    );

    return {
      id: created.id,
      name: created.name,
      key: raw,
      keyPrefix: created.keyPrefix,
      scopes: created.scopes,
      rateLimitPerMinute: created.rateLimitPerMinute,
      createdAt: created.createdAt,
    };
  }

  /** Never returns `keyHash` — the raw key is shown once at creation time only. */
  async list(organizationId: string) {
    return this.prisma.client.apiKey.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimitPerMinute: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(organizationId: string, actorUserId: string, id: string): Promise<void> {
    const apiKey = await this.prisma.client.apiKey.findFirst({ where: { id, organizationId } });
    if (!apiKey) throw new NotFoundException('API key not found');

    await this.prisma.client.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    await this.auditLog.record(
      organizationId,
      { userId: actorUserId },
      'api_key.revoked',
      'ApiKey',
      id,
      { name: apiKey.name },
    );
  }
}
