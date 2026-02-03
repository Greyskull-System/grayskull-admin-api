import { Module } from '@nestjs/common';
import { MigrationsController } from './migrations.controller';
import { MigrationsService } from './migrations.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule],
  controllers: [MigrationsController],
  providers: [MigrationsService],
  exports: [MigrationsService],
})
export class MigrationsModule {}
