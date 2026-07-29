import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PipelineService {
  constructor(private prisma: PrismaService) {}

  async createStage(
    organizationId: string,
    data: { name: string; order: number; isWon?: boolean; isLost?: boolean },
  ) {
    return this.prisma.client.pipelineStage.create({
      data: {
        organizationId,
        name: data.name,
        order: data.order,
        isWon: data.isWon || false,
        isLost: data.isLost || false,
      },
    });
  }

  async getStages(organizationId: string) {
    return this.prisma.client.pipelineStage.findMany({
      where: { organizationId },
      orderBy: { order: 'asc' },
    });
  }

  async updateStage(
    organizationId: string,
    stageId: string,
    data: { name?: string; order?: number },
  ) {
    const stage = await this.prisma.client.pipelineStage.findUnique({
      where: { id: stageId },
    });

    if (!stage || stage.organizationId !== organizationId) {
      throw new NotFoundException('Pipeline stage not found');
    }

    return this.prisma.client.pipelineStage.update({
      where: { id: stageId },
      data,
    });
  }

  async deleteStage(organizationId: string, stageId: string) {
    const stage = await this.prisma.client.pipelineStage.findUnique({
      where: { id: stageId },
    });

    if (!stage || stage.organizationId !== organizationId) {
      throw new NotFoundException('Pipeline stage not found');
    }

    await this.prisma.client.pipelineStage.delete({
      where: { id: stageId },
    });
  }
}
