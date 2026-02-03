import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post()
  create(@Body() body: {
    tenantId: string;
    planId: string;
    trialDays?: number;
  }) {
    return this.subscriptionService.create(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.subscriptionService.findById(id);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.subscriptionService.activate(id);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.subscriptionService.cancel(id, reason);
  }

  @Post(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.subscriptionService.suspend(id);
  }

  @Patch(':id/plan')
  changePlan(
    @Param('id') id: string,
    @Body('planId') planId: string,
  ) {
    return this.subscriptionService.changePlan(id, planId);
  }
}
