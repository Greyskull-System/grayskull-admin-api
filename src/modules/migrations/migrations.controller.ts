import { Controller, Post, Get, Param } from '@nestjs/common';
import { MigrationsService } from './migrations.service';

@Controller('migrations')
export class MigrationsController {
  constructor(private readonly migrationsService: MigrationsService) {}

  /**
   * Aplica TODAS as migrations (padrão + customizadas) para um tenant
   */
  @Post('tenant/:tenantId/apply')
  applyMigrations(@Param('tenantId') tenantId: string) {
    return this.migrationsService.applyMigrations(tenantId);
  }

  /**
   * Aplica migrations apenas dos módulos que ainda não foram migrados
   * Útil quando novos módulos são adicionados a um tenant já provisionado
   */
  @Post('tenant/:tenantId/apply-pending')
  applyPendingMigrations(@Param('tenantId') tenantId: string) {
    return this.migrationsService.applyPendingMigrations(tenantId);
  }

  /**
   * Aplica migrations de um módulo específico para um tenant
   * Útil quando você adiciona apenas um módulo novo
   */
  @Post('tenant/:tenantId/module/:moduleId/apply')
  applyModuleMigrations(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
  ) {
    return this.migrationsService.applyModuleMigrations(tenantId, moduleId);
  }

  /**
   * Retorna status das migrations de um tenant
   * Inclui quais módulos já foram migrados e quais estão pendentes
   */
  @Get('tenant/:tenantId/status')
  getMigrationsStatus(@Param('tenantId') tenantId: string) {
    return this.migrationsService.getMigrationsStatus(tenantId);
  }
}
