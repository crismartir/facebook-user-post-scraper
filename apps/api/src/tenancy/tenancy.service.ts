import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class TenancyService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async getTenantOverview(tenantId: string) {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        throw new NotFoundException();
      }
      const members = await tx.membership.findMany({
        where: { tenantId },
        include: { user: { select: { id: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      });

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan,
          status: tenant.status,
          trialEndsAt: tenant.trialEndsAt,
        },
        members: members.map((m) => ({
          userId: m.userId,
          email: m.user.email,
          role: m.role,
          acceptedAt: m.acceptedAt,
        })),
      };
    });
  }
}
