import { MembershipRole } from '@prisma/client';

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  sessionId: string;
  role: MembershipRole;
}
