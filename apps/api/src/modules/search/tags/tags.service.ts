import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prospect/db';
import type { Tag } from '@prospect/db';
import type { CreateTagInput } from '@prospect/shared';
import { PrismaService } from '../../../prisma/prisma.service';

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, input: CreateTagInput): Promise<Tag> {
    try {
      return await this.prisma.client.tag.create({
        data: { organizationId, name: input.name, color: input.color },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictException('A tag with this name already exists in this organization');
      }
      throw err;
    }
  }

  async list(organizationId: string): Promise<Tag[]> {
    return this.prisma.client.tag.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async attachToCompany(organizationId: string, companyId: string, tagId: string): Promise<void> {
    await this.assertCompanyAndTagInOrg(organizationId, companyId, tagId);
    await this.prisma.client.companyTag.upsert({
      where: { companyId_tagId: { companyId, tagId } },
      create: { companyId, tagId },
      update: {},
    });
  }

  async detachFromCompany(organizationId: string, companyId: string, tagId: string): Promise<void> {
    await this.assertCompanyAndTagInOrg(organizationId, companyId, tagId);
    await this.prisma.client.companyTag.deleteMany({ where: { companyId, tagId } });
  }

  async attachToContact(organizationId: string, contactId: string, tagId: string): Promise<void> {
    await this.assertContactAndTagInOrg(organizationId, contactId, tagId);
    await this.prisma.client.contactTag.upsert({
      where: { contactId_tagId: { contactId, tagId } },
      create: { contactId, tagId },
      update: {},
    });
  }

  async detachFromContact(organizationId: string, contactId: string, tagId: string): Promise<void> {
    await this.assertContactAndTagInOrg(organizationId, contactId, tagId);
    await this.prisma.client.contactTag.deleteMany({ where: { contactId, tagId } });
  }

  private async assertCompanyAndTagInOrg(
    organizationId: string,
    companyId: string,
    tagId: string,
  ): Promise<void> {
    const [company, tag] = await Promise.all([
      this.prisma.client.company.findUnique({ where: { id: companyId } }),
      this.prisma.client.tag.findUnique({ where: { id: tagId } }),
    ]);
    if (!company || company.organizationId !== organizationId) {
      throw new NotFoundException('Company not found');
    }
    if (!tag || tag.organizationId !== organizationId) {
      throw new NotFoundException('Tag not found');
    }
  }

  private async assertContactAndTagInOrg(
    organizationId: string,
    contactId: string,
    tagId: string,
  ): Promise<void> {
    const [contact, tag] = await Promise.all([
      this.prisma.client.contact.findUnique({ where: { id: contactId } }),
      this.prisma.client.tag.findUnique({ where: { id: tagId } }),
    ]);
    if (!contact || contact.organizationId !== organizationId) {
      throw new NotFoundException('Contact not found');
    }
    if (!tag || tag.organizationId !== organizationId) {
      throw new NotFoundException('Tag not found');
    }
  }
}
