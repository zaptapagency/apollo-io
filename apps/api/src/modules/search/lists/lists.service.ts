import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { List } from '@prospect/db';
import type { AddToListInput, CreateListInput } from '@prospect/shared';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ListsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, input: CreateListInput): Promise<List> {
    return this.prisma.client.list.create({
      data: { organizationId, name: input.name, type: input.type },
    });
  }

  async list(organizationId: string): Promise<List[]> {
    return this.prisma.client.list.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Adds companies and/or contacts to a list, skipping any that are already members. Every id is
   * verified to belong to the caller's organization (and to match the list's `type`) before
   * insertion — a client cannot smuggle another organization's row into their list. */
  async addMembers(organizationId: string, input: AddToListInput): Promise<{ added: number }> {
    const list = await this.getOwnedList(organizationId, input.listId);

    if (list.type === 'COMPANY' && input.contactIds?.length) {
      throw new BadRequestException('Cannot add contacts to a COMPANY list');
    }
    if (list.type === 'CONTACT' && input.companyIds?.length) {
      throw new BadRequestException('Cannot add companies to a CONTACT list');
    }

    const rows: { listId: string; companyId?: string; contactId?: string }[] = [];

    if (input.companyIds?.length) {
      const count = await this.prisma.client.company.count({
        where: { organizationId, id: { in: input.companyIds } },
      });
      if (count !== new Set(input.companyIds).size) {
        throw new BadRequestException('One or more companyIds do not belong to this organization');
      }
      rows.push(...input.companyIds.map((companyId) => ({ listId: list.id, companyId })));
    }

    if (input.contactIds?.length) {
      const count = await this.prisma.client.contact.count({
        where: { organizationId, id: { in: input.contactIds } },
      });
      if (count !== new Set(input.contactIds).size) {
        throw new BadRequestException('One or more contactIds do not belong to this organization');
      }
      rows.push(...input.contactIds.map((contactId) => ({ listId: list.id, contactId })));
    }

    if (rows.length === 0) return { added: 0 };

    const result = await this.prisma.client.listMembership.createMany({
      data: rows,
      skipDuplicates: true,
    });
    return { added: result.count };
  }

  async removeMember(organizationId: string, listId: string, membershipId: string): Promise<void> {
    await this.getOwnedList(organizationId, listId);

    const membership = await this.prisma.client.listMembership.findUnique({
      where: { id: membershipId },
    });
    if (!membership || membership.listId !== listId) {
      throw new NotFoundException('List membership not found');
    }

    await this.prisma.client.listMembership.delete({ where: { id: membershipId } });
  }

  async listMembers(organizationId: string, listId: string) {
    await this.getOwnedList(organizationId, listId);
    return this.prisma.client.listMembership.findMany({
      where: { listId },
      include: { company: true, contact: true },
    });
  }

  private async getOwnedList(organizationId: string, listId: string): Promise<List> {
    const list = await this.prisma.client.list.findUnique({ where: { id: listId } });
    if (!list || list.organizationId !== organizationId) {
      throw new NotFoundException('List not found');
    }
    return list;
  }
}
