import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DealsService {
  private readonly logger = new Logger(DealsService.name);

  constructor(private prisma: PrismaService) {}

  async createDeal(
    organizationId: string,
    data: {
      companyId: string;
      name: string;
      amountUsd?: number;
      stageId: string;
      ownerId?: string;
    },
  ) {
    const stage = await this.prisma.client.pipelineStage.findUnique({
      where: { id: data.stageId },
    });

    if (!stage || stage.organizationId !== organizationId) {
      throw new NotFoundException('Pipeline stage not found');
    }

    return this.prisma.client.deal.create({
      data: {
        organizationId,
        companyId: data.companyId,
        name: data.name,
        amountUsd: data.amountUsd || 0,
        stageId: data.stageId,
        ownerId: data.ownerId,
      },
    });
  }

  async getDeal(organizationId: string, dealId: string) {
    const deal = await this.prisma.client.deal.findUnique({
      where: { id: dealId },
      include: { stage: true, company: true },
    });

    if (!deal || deal.organizationId !== organizationId) {
      throw new NotFoundException('Deal not found');
    }

    return deal;
  }

  async updateDeal(
    organizationId: string,
    dealId: string,
    data: {
      name?: string;
      amountUsd?: number;
      stageId?: string;
      ownerId?: string;
    },
  ) {
    await this.getDeal(organizationId, dealId);

    const updateData: { name?: string; amountUsd?: number; stageId?: string; ownerId?: string } = {};
    if (data.name) updateData.name = data.name;
    if (data.amountUsd !== undefined) updateData.amountUsd = data.amountUsd;
    if (data.stageId) updateData.stageId = data.stageId;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;

    return this.prisma.client.deal.update({
      where: { id: dealId },
      data: updateData,
    });
  }

  async listDeals(organizationId: string, stageId?: string) {
    return this.prisma.client.deal.findMany({
      where: {
        organizationId,
        stageId: stageId,
      },
      include: { stage: true, company: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteDeal(organizationId: string, dealId: string) {
    await this.getDeal(organizationId, dealId);

    await this.prisma.client.deal.delete({
      where: { id: dealId },
    });
  }
}
