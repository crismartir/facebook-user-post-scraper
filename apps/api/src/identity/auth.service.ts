import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { MembershipRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TokenService } from './token.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { hashPassword, verifyPassword } from './password.util';
import { addDays, slugify } from './slug.util';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  role: MembershipRole;
}

const TRIAL_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await hashPassword(dto.password);
    const tenantId = randomUUID();
    const slug = `${slugify(dto.companyName)}-${tenantId.slice(0, 8)}`;

    let user: { id: string };
    try {
      const created = await this.tenantPrisma.run(tenantId, async (tx) => {
        await tx.tenant.create({
          data: {
            id: tenantId,
            name: dto.companyName,
            slug,
            trialEndsAt: addDays(new Date(), TRIAL_DAYS),
          },
        });
        const createdUser = await tx.user.create({
          data: { email: dto.email, passwordHash },
        });
        await tx.membership.create({
          data: {
            tenantId,
            userId: createdUser.id,
            role: 'owner',
            acceptedAt: new Date(),
          },
        });
        return createdUser;
      });
      user = created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('E-mail já cadastrado');
      }
      throw error;
    }

    return this.issueSession({ userId: user.id, tenantId, role: 'owner' }, meta);
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await verifyPassword(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Fase 0: assume-se uma membership por usuário (o fluxo de convite/troca
    // de tenant chega na Fase 1). runAsUser é necessário porque o tenant
    // ainda não é conhecido neste ponto — ver TenantPrismaService.runAsUser.
    const membership = await this.tenantPrisma.runAsUser(user.id, (tx) =>
      tx.membership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
    );
    if (!membership) {
      throw new UnauthorizedException('Usuário sem empresa associada');
    }

    return this.issueSession(
      { userId: user.id, tenantId: membership.tenantId, role: membership.role },
      meta,
    );
  }

  async refresh(refreshPlain: string | undefined): Promise<Pick<AuthResult, 'accessToken' | 'refreshToken'>> {
    if (!refreshPlain) {
      throw new UnauthorizedException('Refresh token ausente');
    }
    const tokenHash = this.tokenService.hashRefreshToken(refreshPlain);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { session: true },
    });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date() || existing.session.revokedAt) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    if (existing.usedAt) {
      await this.revokeSession(existing.sessionId);
      throw new UnauthorizedException('Refresh token reutilizado — sessão revogada');
    }

    const membership = await this.tenantPrisma.run(existing.tenantId, (tx) =>
      tx.membership.findFirst({
        where: { tenantId: existing.tenantId, userId: existing.session.userId },
      }),
    );
    if (!membership) {
      await this.revokeSession(existing.sessionId);
      throw new UnauthorizedException('Vínculo com a empresa não encontrado');
    }

    const newPlain = this.tokenService.generateRefreshTokenPlaintext();
    const newHash = this.tokenService.hashRefreshToken(newPlain);

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          sessionId: existing.sessionId,
          tenantId: existing.tenantId,
          tokenHash: newHash,
          rotatedFrom: existing.id,
          expiresAt: this.tokenService.refreshTokenExpiryDate(),
        },
      }),
    ]);

    const accessToken = await this.tokenService.signAccessToken({
      userId: existing.session.userId,
      tenantId: existing.tenantId,
      sessionId: existing.sessionId,
      role: membership.role,
    });

    return { accessToken, refreshToken: newPlain };
  }

  async logout(refreshPlain: string | undefined): Promise<void> {
    if (!refreshPlain) return;
    const tokenHash = this.tokenService.hashRefreshToken(refreshPlain);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (existing) {
      await this.revokeSession(existing.sessionId);
    }
  }

  private async issueSession(
    input: { userId: string; tenantId: string; role: MembershipRole },
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const session = await this.prisma.session.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    const refreshPlain = this.tokenService.generateRefreshTokenPlaintext();
    await this.prisma.refreshToken.create({
      data: {
        sessionId: session.id,
        tenantId: input.tenantId,
        tokenHash: this.tokenService.hashRefreshToken(refreshPlain),
        expiresAt: this.tokenService.refreshTokenExpiryDate(),
      },
    });

    const accessToken = await this.tokenService.signAccessToken({
      userId: input.userId,
      tenantId: input.tenantId,
      sessionId: session.id,
      role: input.role,
    });

    return { accessToken, refreshToken: refreshPlain, tenantId: input.tenantId, role: input.role };
  }

  private async revokeSession(sessionId: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: now } }),
      this.prisma.refreshToken.updateMany({ where: { sessionId }, data: { revokedAt: now } }),
    ]);
  }
}
