import type { Request } from 'express';
import type { OrgRole } from '@prospect/shared';

export interface AuthContext {
  userId: string;
  email: string;
  organizationId: string;
  role: OrgRole;
  authMethod: 'session' | 'apiKey';
  apiKeyId?: string;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}
