import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { adminPrisma, SubscriptionStatus, TenantStatus } from '@modulys-pax/admin-database';

@Injectable()
export class SubscriptionService {
  async create(data: {
    tenantId: string;
    planId: string;
    trialDays?: number;
  }) {
    // Verifica se o tenant já tem assinatura
    const existing = await adminPrisma.subscription.findUnique({
      where: { tenantId: data.tenantId },
    });

    if (existing) {
      throw new ConflictException('Tenant já possui uma assinatura');
    }

    const now = new Date();
    const trialDays = data.trialDays || 14;
    const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    // Cria a assinatura
    const subscription = await adminPrisma.subscription.create({
      data: {
        tenantId: data.tenantId,
        planId: data.planId,
        status: SubscriptionStatus.TRIAL,
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
      },
      include: {
        tenant: true,
        plan: { include: { modules: { include: { module: true } } } },
      },
    });

    // Atualiza o status do tenant para TRIAL
    await adminPrisma.tenant.update({
      where: { id: data.tenantId },
      data: { status: TenantStatus.TRIAL },
    });

    // Habilita os módulos do plano para o tenant
    const planModules = subscription.plan.modules;
    for (const pm of planModules) {
      await adminPrisma.tenantModule.upsert({
        where: {
          tenantId_moduleId: { tenantId: data.tenantId, moduleId: pm.moduleId },
        },
        update: { isEnabled: true },
        create: {
          tenantId: data.tenantId,
          moduleId: pm.moduleId,
          isEnabled: true,
        },
      });
    }

    return subscription;
  }

  async findById(id: string) {
    const subscription = await adminPrisma.subscription.findUnique({
      where: { id },
      include: {
        tenant: true,
        plan: true,
        invoices: { orderBy: { dueDate: 'desc' } },
      },
    });

    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada');
    }

    return subscription;
  }

  async activate(id: string) {
    const subscription = await this.findById(id);

    const now = new Date();
    const periodEnd = this.calculatePeriodEnd(now, subscription.plan.billingCycle);

    // Atualiza a assinatura
    const updated = await adminPrisma.subscription.update({
      where: { id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialEndsAt: null,
      },
    });

    // Atualiza o status do tenant
    await adminPrisma.tenant.update({
      where: { id: subscription.tenantId },
      data: { status: TenantStatus.ACTIVE },
    });

    return updated;
  }

  async cancel(id: string, reason?: string) {
    const subscription = await this.findById(id);

    const updated = await adminPrisma.subscription.update({
      where: { id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });

    // Atualiza o status do tenant
    await adminPrisma.tenant.update({
      where: { id: subscription.tenantId },
      data: { status: TenantStatus.CANCELLED },
    });

    return updated;
  }

  async suspend(id: string) {
    const subscription = await this.findById(id);

    const updated = await adminPrisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.PAST_DUE },
    });

    await adminPrisma.tenant.update({
      where: { id: subscription.tenantId },
      data: { status: TenantStatus.SUSPENDED },
    });

    return updated;
  }

  async changePlan(id: string, newPlanId: string) {
    const subscription = await this.findById(id);

    // Atualiza a assinatura
    const updated = await adminPrisma.subscription.update({
      where: { id },
      data: { planId: newPlanId },
      include: { plan: { include: { modules: { include: { module: true } } } } },
    });

    // Desabilita todos os módulos atuais
    await adminPrisma.tenantModule.updateMany({
      where: { tenantId: subscription.tenantId },
      data: { isEnabled: false, disabledAt: new Date() },
    });

    // Habilita os módulos do novo plano
    for (const pm of updated.plan.modules) {
      await adminPrisma.tenantModule.upsert({
        where: {
          tenantId_moduleId: { tenantId: subscription.tenantId, moduleId: pm.moduleId },
        },
        update: { isEnabled: true, disabledAt: null },
        create: {
          tenantId: subscription.tenantId,
          moduleId: pm.moduleId,
          isEnabled: true,
        },
      });
    }

    return updated;
  }

  private calculatePeriodEnd(start: Date, billingCycle: string): Date {
    const end = new Date(start);
    switch (billingCycle) {
      case 'MONTHLY':
        end.setMonth(end.getMonth() + 1);
        break;
      case 'QUARTERLY':
        end.setMonth(end.getMonth() + 3);
        break;
      case 'SEMIANNUAL':
        end.setMonth(end.getMonth() + 6);
        break;
      case 'ANNUAL':
        end.setFullYear(end.getFullYear() + 1);
        break;
    }
    return end;
  }
}
