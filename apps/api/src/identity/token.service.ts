import { createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MembershipRole } from '@prisma/client';

export interface AccessTokenPayload {
  userId: string;
  tenantId: string;
  sessionId: string;
  role: MembershipRole;
}

const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TTL ?? '15m';
export const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: ACCESS_TOKEN_TTL,
    });
  }

  /** Opaque, high-entropy refresh token. Only its HMAC hash is ever persisted. */
  generateRefreshTokenPlaintext(): string {
    return randomBytes(48).toString('base64url');
  }

  hashRefreshToken(plaintext: string): string {
    const secret = process.env.REFRESH_TOKEN_HASH_SECRET;
    if (!secret) {
      throw new Error('REFRESH_TOKEN_HASH_SECRET não configurado');
    }
    return createHmac('sha256', secret).update(plaintext).digest('hex');
  }

  refreshTokenExpiryDate(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
    return expiresAt;
  }
}
