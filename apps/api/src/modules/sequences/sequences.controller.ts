import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { AuthContext } from '../../common/request-context';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { z } from 'zod';
import { SequencesService } from './sequences.service';

const createSequenceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const enrollContactSchema = z.object({
  contactId: z.string().cuid(),
  sequenceId: z.string().cuid(),
});

@ApiTags('Sequences')
@Controller('sequences')
@UseGuards(RolesGuard)
@ApiBearerAuth()
export class SequencesController {
  constructor(private sequencesService: SequencesService) {}

  @Post()
  @Roles('REP')
  @ApiOperation({ summary: 'Create a new sequence' })
  async createSequence(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createSequenceSchema))
    body: { name: string; description?: string },
  ) {
    return this.sequencesService.createSequence(auth.organizationId, body);
  }

  @Get(':id')
  @Roles('REP')
  @ApiOperation({ summary: 'Get sequence details' })
  async getSequence(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.sequencesService.getSequence(auth.organizationId, id);
  }

  @Patch(':id')
  @Roles('REP')
  @ApiOperation({ summary: 'Update sequence' })
  async updateSequence(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createSequenceSchema))
    body: { name: string; description?: string },
  ) {
    return this.sequencesService.updateSequence(auth.organizationId, id, body);
  }

  @Delete(':id')
  @Roles('REP')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete sequence' })
  async deleteSequence(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    await this.sequencesService.deleteSequence(auth.organizationId, id);
  }

  @Post(':id/enroll')
  @Roles('REP')
  @HttpCode(201)
  @ApiOperation({ summary: 'Enroll a contact in a sequence' })
  async enrollContact(
    @CurrentAuth() auth: AuthContext,
    @Param('id') sequenceId: string,
    @Body(new ZodValidationPipe(enrollContactSchema))
    body: { contactId: string },
  ) {
    return this.sequencesService.enrollContact(auth.organizationId, sequenceId, body.contactId);
  }

  @Get(':id/enrollments')
  @Roles('REP')
  @ApiOperation({ summary: 'List enrollments in a sequence' })
  async getEnrollments(@CurrentAuth() auth: AuthContext, @Param('id') sequenceId: string) {
    return this.sequencesService.getEnrollments(auth.organizationId, sequenceId);
  }
}
