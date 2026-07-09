import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Second line of defense for multi-tenant isolation (docs/architecture/multi-tenant-model.md):
 * rejects with 404 — not 403 — so a caller cannot distinguish "not yours" from
 * "does not exist". RLS (ADR-0001) is the first line; this guard prevents a
 * cross-tenant query from ever reaching the database.
 */
@Injectable()
export class TenantParamGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const paramTenantId = request.params?.tenantId;
    if (paramTenantId && paramTenantId !== request.user.tenantId) {
      throw new NotFoundException();
    }
    return true;
  }
}
