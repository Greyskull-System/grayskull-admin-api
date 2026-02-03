import { Injectable, NotFoundException } from '@nestjs/common';
import { adminPrisma, BillingCycle } from '@grayskull/admin-database';

@Injectable()
export class PlanService {
  async create(data: {
    code: string;
    name: string;
    description?: string;
    price: number;
    billingCycle?: BillingCycle;
    maxUsers?: number;
    maxBranches?: number;
    moduleIds?: string[];
  }) {
    const { moduleIds, ...planData } = data;

    return adminPrisma.plan.create({
      data: {
        ...planData,
        modules: moduleIds ? {
          create: moduleIds.map((moduleId) => ({ moduleId })),
        } : undefined,
      },
      include: {
        modules: { include: { module: true } },
      },
    });
  }

  async findAll() {
    return adminPrisma.plan.findMany({
      include: {
        modules: { include: { module: true } },
        _count: { select: { subscriptions: true } },
      },
      orderBy: { price: 'asc' },
    });
  }

  async findById(id: string) {
    const plan = await adminPrisma.plan.findUnique({
      where: { id },
      include: {
        modules: { include: { module: true } },
        subscriptions: {
          include: { tenant: true },
          where: { status: { in: ['ACTIVE', 'TRIAL'] } },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Plano não encontrado');
    }

    return plan;
  }

  async update(id: string, data: Partial<{
    name: string;
    description: string;
    price: number;
    maxUsers: number;
    maxBranches: number;
    isActive: boolean;
  }>) {
    await this.findById(id);

    return adminPrisma.plan.update({
      where: { id },
      data,
    });
  }

  async addModule(planId: string, moduleId: string) {
    return adminPrisma.planModule.create({
      data: { planId, moduleId },
      include: { module: true },
    });
  }

  async removeModule(planId: string, moduleId: string) {
    return adminPrisma.planModule.delete({
      where: {
        planId_moduleId: { planId, moduleId },
      },
    });
  }
}
