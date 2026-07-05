import { Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { OrganizationsController } from './organizations/organizations.controller';
import { OrganizationsService } from './organizations/organizations.service';
import { MembersController } from './members/members.controller';
import { MembersService } from './members/members.service';
import { ApiKeysController } from './api-keys/api-keys.controller';
import { ApiKeysService } from './api-keys/api-keys.service';
import { AuditLogController } from './audit-log/audit-log.controller';
import { AuditLogService } from './audit-log/audit-log.service';
import { BillingController } from './billing/billing.controller';
import { BillingService } from './billing/billing.service';
import { WebhooksController } from './webhooks/webhooks.controller';
import { WebhooksService } from './webhooks/webhooks.service';
import { WebhookDispatchService } from './webhooks/webhook-dispatch.service';

// Workstream E: auth (signup/signin/session), org/membership management, API keys, audit log,
// Stripe billing, webhooks dispatch. `WebhookDispatchService` is exported so other feature
// modules (sequences, crm, etc.) can fire outbound webhook events without re-implementing
// endpoint lookup/HMAC signing/delivery bookkeeping.
@Module({
  controllers: [
    AuthController,
    OrganizationsController,
    MembersController,
    ApiKeysController,
    AuditLogController,
    BillingController,
    WebhooksController,
  ],
  providers: [
    AuthService,
    OrganizationsService,
    MembersService,
    ApiKeysService,
    AuditLogService,
    BillingService,
    WebhooksService,
    WebhookDispatchService,
  ],
  exports: [WebhookDispatchService, AuditLogService],
})
export class PlatformModule {}
