import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrollmentStatus } from '@prospect/shared';

@Injectable()
export class SequencesService {
  private readonly logger = new Logger(SequencesService.name);

  constructor(private prisma: PrismaService) {}

  async createSequence(
    organizationId: string,
    data: {
      name: string;
      description?: string;
    },
  ) {
    return this.prisma.client.sequence.create({
      data: {
        organizationId,
        name: data.name,
        status: 'DRAFT',
      },
    });
  }

  async getSequence(organizationId: string, sequenceId: string) {
    const sequence = await this.prisma.client.sequence.findUnique({
      where: { id: sequenceId },
      include: { steps: true, enrollments: true },
    });

    if (!sequence || sequence.organizationId !== organizationId) {
      throw new NotFoundException('Sequence not found');
    }

    return sequence;
  }

  async updateSequence(
    organizationId: string,
    sequenceId: string,
    data: {
      name: string;
      description?: string;
    },
  ) {
    // Verify sequence belongs to org
    await this.getSequence(organizationId, sequenceId);

    return this.prisma.client.sequence.update({
      where: { id: sequenceId },
      data: {
        name: data.name,
      },
    });
  }

  async deleteSequence(organizationId: string, sequenceId: string) {
    // Verify sequence belongs to org
    await this.getSequence(organizationId, sequenceId);

    await this.prisma.client.sequence.delete({
      where: { id: sequenceId },
    });
  }

  async enrollContact(organizationId: string, sequenceId: string, contactId: string) {
    // Verify sequence and contact belong to org
    await this.getSequence(organizationId, sequenceId);
    const contact = await this.prisma.client.contact.findUnique({ where: { id: contactId } });

    if (!contact || contact.organizationId !== organizationId) {
      throw new NotFoundException('Contact not found');
    }

    // Create enrollment
    const enrollment = await this.prisma.client.sequenceEnrollment.create({
      data: {
        sequenceId,
        contactId,
        status: 'ACTIVE' as EnrollmentStatus,
        currentStepOrder: 1,
      },
    });

    this.logger.log(
      `Enrolled contact ${contactId} in sequence ${sequenceId} for org ${organizationId}`,
    );

    return enrollment;
  }

  async getEnrollments(organizationId: string, sequenceId: string) {
    // Verify sequence belongs to org
    await this.getSequence(organizationId, sequenceId);

    return this.prisma.client.sequenceEnrollment.findMany({
      where: {
        sequenceId,
      },
      include: {
        contact: true,
      },
    });
  }

  async updateEnrollmentStatus(
    organizationId: string,
    enrollmentId: string,
    status: EnrollmentStatus,
  ) {
    const enrollment = await this.prisma.client.sequenceEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { sequence: true },
    });

    if (!enrollment || enrollment.sequence.organizationId !== organizationId) {
      throw new NotFoundException('Enrollment not found');
    }

    return this.prisma.client.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status },
    });
  }
}
