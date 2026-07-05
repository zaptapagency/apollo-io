import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Contact } from '@prospect/db';
import type { CreateContactInput, UpdateContactInput } from '@prospect/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { OpenSearchIndexerService } from '../opensearch/opensearch-indexer.service';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly indexer: OpenSearchIndexerService,
  ) {}

  async create(organizationId: string, input: CreateContactInput): Promise<Contact> {
    if (input.companyId) {
      await this.assertCompanyInOrg(organizationId, input.companyId);
    }

    const contact = await this.prisma.client.contact.create({
      data: {
        organizationId,
        companyId: input.companyId,
        firstName: input.firstName,
        lastName: input.lastName,
        title: input.title,
        seniority: input.seniority,
        department: input.department,
        email: input.email,
        phone: input.phone,
        linkedinUrl: input.linkedinUrl,
        city: input.city,
        state: input.state,
        country: input.country,
      },
    });

    await this.safeIndex(() => this.indexer.indexContact(contact));
    return contact;
  }

  /** Always scoped by organization: fetches by primary key, then explicitly checks the row
   * belongs to the caller's org, throwing 404 rather than trusting a compound `findUnique`. */
  async findOne(organizationId: string, id: string): Promise<Contact> {
    const contact = await this.prisma.client.contact.findUnique({ where: { id } });
    if (!contact || contact.organizationId !== organizationId) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  async update(organizationId: string, id: string, input: UpdateContactInput): Promise<Contact> {
    await this.findOne(organizationId, id);
    if (input.companyId) {
      await this.assertCompanyInOrg(organizationId, input.companyId);
    }

    const contact = await this.prisma.client.contact.update({
      where: { id },
      data: {
        companyId: input.companyId,
        firstName: input.firstName,
        lastName: input.lastName,
        title: input.title,
        seniority: input.seniority,
        department: input.department,
        email: input.email,
        phone: input.phone,
        linkedinUrl: input.linkedinUrl,
        city: input.city,
        state: input.state,
        country: input.country,
      },
    });

    await this.safeIndex(() => this.indexer.indexContact(contact));
    return contact;
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.findOne(organizationId, id);
    await this.prisma.client.contact.delete({ where: { id } });
    await this.safeIndex(() => this.indexer.deleteContact(id));
  }

  /** A contact's `companyId` is client-supplied — without this check a caller could attach their
   * contact to another organization's company by guessing its id. */
  private async assertCompanyInOrg(organizationId: string, companyId: string): Promise<void> {
    const company = await this.prisma.client.company.findUnique({ where: { id: companyId } });
    if (!company || company.organizationId !== organizationId) {
      throw new BadRequestException('companyId does not belong to this organization');
    }
  }

  private async safeIndex(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.warn(
        `Unexpected error indexing into OpenSearch (Postgres write already committed): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
