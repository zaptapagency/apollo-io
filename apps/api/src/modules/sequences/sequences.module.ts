import { Module } from '@nestjs/common';

// Workstream C fills this in: sequences/steps/enrollments, BullMQ scheduler, email send worker
// (tracking pixel + link rewriting), mailbox connection, bounce/open/click/reply webhooks.
@Module({})
export class SequencesModule {}
