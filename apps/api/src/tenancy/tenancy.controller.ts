import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { TenancyService } from './tenancy.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { TenantParamGuard } from '../common/guards/tenant-param.guard';

@Controller('tenancy')
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.tenancyService.getTenantOverview(user.tenantId);
  }

  /**
   * Endpoint parametrizado por :tenantId — existe para permitir o teste de
   * isolamento cross-tenant (docs/architecture/multi-tenant-model.md):
   * TenantParamGuard rejeita com 404 antes de qualquer query se o tenantId
   * da rota não bater com o do token.
   */
  @UseGuards(TenantParamGuard)
  @Get('tenants/:tenantId')
  async byId(@Param('tenantId') tenantId: string) {
    return this.tenancyService.getTenantOverview(tenantId);
  }
}
