import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/**
 * Enforces ADR-0001: every tenant-scoped query runs inside a transaction
 * with `app.tenant_id` set via `set_config(..., true)` (transaction-local),
 * so PostgreSQL RLS policies can filter rows by tenant even if a repository
 * forgets an explicit `tenant_id` filter. This is defense in depth, not a
 * replacement for filtering explicitly in application code.
 */
@Injectable()
export class TenantPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(tenantId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    });
  }

  /**
   * For the login-time bootstrap problem: resolving which tenant(s) a user
   * belongs to happens before a tenant is known. The `memberships` RLS policy
   * allows a row through if it matches `app.tenant_id` OR `app.user_id`
   * (see prisma/migrations/*_enable_rls), so this lets a user see only their
   * own membership rows without yet having selected a tenant.
   */
  async runAsUser<T>(userId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      return fn(tx);
    });
  }
}
