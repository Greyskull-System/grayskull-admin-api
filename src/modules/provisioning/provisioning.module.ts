import { Module } from '@nestjs/common';
import { ProvisioningService } from './provisioning.service';
import { ProvisioningController } from './provisioning.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule],
  controllers: [ProvisioningController],
  providers: [ProvisioningService],
  exports: [ProvisioningService],
})
export class ProvisioningModule {}
