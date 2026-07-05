import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { signInSchema, signUpSchema } from '@prospect/shared';
import type { SignInInput, SignUpInput } from '@prospect/shared';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentAuth } from '../../../common/decorators/current-auth.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthContext } from '../../../common/request-context';
import { AuthService } from './auth.service';
import { extractBearerToken } from './bearer-token.util';

@ApiTags('platform/auth')
@Controller('platform/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('signup')
  signUp(@Body(new ZodValidationPipe(signUpSchema)) body: SignUpInput) {
    return this.authService.signUp(body);
  }

  @Public()
  @Post('signin')
  signIn(@Body(new ZodValidationPipe(signInSchema)) body: SignInInput) {
    return this.authService.signIn(body);
  }

  @Post('signout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(@Req() req: Request): Promise<void> {
    const token = extractBearerToken(req);
    if (token) await this.authService.signOut(token);
  }

  @Get('me')
  async me(@CurrentAuth() auth: AuthContext) {
    const organization = await this.prisma.client.organization.findUnique({
      where: { id: auth.organizationId },
      select: { id: true, name: true, slug: true },
    });

    if (auth.authMethod === 'apiKey') {
      return { auth, user: null, organization };
    }

    const user = await this.prisma.client.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    return { auth, user, organization };
  }
}
