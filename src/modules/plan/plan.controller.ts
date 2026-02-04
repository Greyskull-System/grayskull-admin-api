import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { PlanService } from './plan.service';
import { BillingCycle } from '@modulys-pax/admin-database';

@Controller('plans')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Post()
  create(@Body() body: {
    code: string;
    name: string;
    description?: string;
    price: number;
    billingCycle?: BillingCycle;
    maxUsers?: number;
    maxBranches?: number;
    moduleIds?: string[];
  }) {
    return this.planService.create(body);
  }

  @Get()
  findAll() {
    return this.planService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.planService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      description?: string;
      price?: number;
      maxUsers?: number;
      maxBranches?: number;
      isActive?: boolean;
    },
  ) {
    return this.planService.update(id, body);
  }

  @Post(':id/modules/:moduleId')
  addModule(
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
  ) {
    return this.planService.addModule(id, moduleId);
  }

  @Delete(':id/modules/:moduleId')
  removeModule(
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
  ) {
    return this.planService.removeModule(id, moduleId);
  }
}
