import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  async getDealConversionFunnel(organizationId: string, dateRange?: { from: Date; to: Date }) {
    const where: { organizationId: string; createdAt?: { gte: Date; lte: Date } } = { organizationId };
    if (dateRange) {
      where.createdAt = {
        gte: dateRange.from,
        lte: dateRange.to,
      };
    }

    const stages = await this.prisma.client.pipelineStage.findMany({
      where: { organizationId },
      orderBy: { order: 'asc' },
    });

    const funnel = await Promise.all(
      stages.map(async (stage) => {
        const count = await this.prisma.client.deal.count({
          where: {
            ...where,
            pipelineStageId: stage.id,
          },
        });
        return {
          stageName: stage.name,
          stageId: stage.id,
          dealCount: count,
        };
      }),
    );

    return funnel;
  }

  async getSequencePerformance(organizationId: string, sequenceId: string) {
    const enrollments = await this.prisma.client.sequenceEnrollment.count({
      where: {
        sequence: { organizationId },
        sequenceId,
      },
    });

    const activeEnrollments = await this.prisma.client.sequenceEnrollment.count({
      where: {
        sequence: { organizationId },
        sequenceId,
        status: 'ACTIVE',
      },
    });

    const completedEnrollments = await this.prisma.client.sequenceEnrollment.count({
      where: {
        sequence: { organizationId },
        sequenceId,
        status: 'COMPLETED',
      },
    });

    const exitedReply = await this.prisma.client.sequenceEnrollment.count({
      where: {
        sequence: { organizationId },
        sequenceId,
        status: 'EXITED_REPLY',
      },
    });

    return {
      totalEnrollments: enrollments,
      activeEnrollments,
      completedEnrollments,
      exitedReplyCount: exitedReply,
      replyRate: enrollments > 0 ? (exitedReply / enrollments) * 100 : 0,
    };
  }

  async getRepLeaderboard(organizationId: string, dateRange?: { from: Date; to: Date }) {
    const where: { organizationId: string; createdAt?: { gte: Date; lte: Date } } = {
      organizationId,
    };

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.from,
        lte: dateRange.to,
      };
    }

    const reps = await this.prisma.client.user.findMany({
      where: {
        memberships: {
          some: { organizationId },
        },
      },
    });

    return Promise.all(
      reps.map(async (rep) => {
        const dealsWon = await this.prisma.client.deal.count({
          where: {
            organizationId,
            stage: { name: 'Won' },
          },
        });

        return {
          userId: rep.id,
          email: rep.email,
          dealsWon,
        };
      }),
    );
  }

  async aggregateDailyMetrics(organizationId: string, date: Date) {
    // Placeholder for future daily aggregation logic
    // In production, this would run as a scheduled BullMQ job
    this.logger.log(`Daily metric aggregation scheduled for ${organizationId} on ${date}`);
    return { aggregated: true };
  }
}
