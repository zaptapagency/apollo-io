import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { SignInInput, SignUpInput, OrgRole } from '@prospect/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { generateSessionToken } from '../common/tokens.util';
import { slugify, withRandomSuffix } from '../common/slug.util';
import { hashPassword, verifyPassword } from '../common/password.util';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AuthResult {
  token: string;
  expiresAt: Date;
  user: { id: string; email: string; name: string };
  organization: { id: string; name: string; slug: string };
  role: OrgRole;
}

/**
 * Sign-up/sign-in/sign-out. Session tokens are opaque cryptographically-random strings (never
 * JWTs) stored server-side in the `Session` table — this is what `AuthGuard` looks up verbatim,
 * so a "log out everywhere" support action is just deleting rows.
 */
@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async signUp(input: SignUpInput): Promise<AuthResult> {
    const existing = await this.prisma.client.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await hashPassword(input.password);
    const slug = await this.uniqueSlug(input.organizationName);

    const { user, organization } = await this.prisma.client.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: input.organizationName, slug },
      });
      const createdUser = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash },
      });
      await tx.membership.create({
        data: { organizationId: org.id, userId: createdUser.id, role: 'OWNER' },
      });
      return { user: createdUser, organization: org };
    });

    const session = await this.createSession(user.id);
    return {
      token: session.token,
      expiresAt: session.expiresAt,
      user: { id: user.id, email: user.email, name: user.name },
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
      role: 'OWNER',
    };
  }

  async signIn(input: SignInInput): Promise<AuthResult> {
    const invalidCredentials = () => new UnauthorizedException('Invalid email or password');

    const user = await this.prisma.client.user.findUnique({
      where: { email: input.email },
      include: { memberships: { include: { organization: true }, orderBy: { createdAt: 'asc' } } },
    });
    if (!user || !user.passwordHash) throw invalidCredentials();

    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) throw invalidCredentials();

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException('This account has no accessible organization');
    }

    const session = await this.createSession(user.id);
    return {
      token: session.token,
      expiresAt: session.expiresAt,
      user: { id: user.id, email: user.email, name: user.name },
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
      },
      role: membership.role as OrgRole,
    };
  }

  async signOut(token: string): Promise<void> {
    await this.prisma.client.session.deleteMany({ where: { token } });
  }

  private async createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.client.session.create({ data: { userId, token, expiresAt } });
    return { token, expiresAt };
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    // Bounded retries — collisions are extremely unlikely, this just avoids an infinite loop.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await this.prisma.client.organization.findUnique({
        where: { slug: candidate },
      });
      if (!existing) return candidate;
      candidate = withRandomSuffix(base);
    }
    return candidate;
  }
}
