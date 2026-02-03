import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantStatus } from '@grayskull/admin-database';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  create(@Body() body: {
    code: string;
    name: string;
    tradeName?: string;
    document: string;
    email: string;
    phone?: string;
    notes?: string;
    planId?: string;      // Usar plano como template
    moduleIds?: string[]; // OU selecionar módulos manualmente
  }) {
    return this.tenantService.create(body);
  }

  @Get()
  findAll(
    @Query('status') status?: TenantStatus,
    @Query('search') search?: string,
  ) {
    return this.tenantService.findAll({ status, search });
  }

  @Get('statistics')
  getStatistics() {
    return this.tenantService.getStatistics();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      tradeName?: string;
      email?: string;
      phone?: string;
      notes?: string;
    },
  ) {
    return this.tenantService.update(id, body);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: TenantStatus,
  ) {
    return this.tenantService.updateStatus(id, status);
  }

  @Post(':id/contacts')
  addContact(
    @Param('id') id: string,
    @Body() body: {
      name: string;
      email: string;
      phone?: string;
      role?: string;
      isPrimary?: boolean;
    },
  ) {
    return this.tenantService.addContact(id, body);
  }

  @Post(':id/modules/:moduleId/enable')
  enableModule(
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
  ) {
    return this.tenantService.enableModule(id, moduleId);
  }

  @Post(':id/modules/:moduleId/disable')
  disableModule(
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
  ) {
    return this.tenantService.disableModule(id, moduleId);
  }

  @Patch(':id/modules')
  setModules(
    @Param('id') id: string,
    @Body('moduleIds') moduleIds: string[],
  ) {
    return this.tenantService.setModules(id, moduleIds);
  }

  @Delete(':id')
  delete(
    @Param('id') id: string,
    @Query('dropDatabase') dropDatabase?: string,
  ) {
    // Por padrão, dropa o banco (dropDatabase !== 'false')
    const shouldDropDatabase = dropDatabase !== 'false';
    return this.tenantService.delete(id, shouldDropDatabase);
  }
}
