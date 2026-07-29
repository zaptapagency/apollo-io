import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SequencesController } from './sequences.controller';
import { SequencesService } from './sequences.service';

@Module({
  imports: [PrismaModule],
  controllers: [SequencesController],
  providers: [SequencesService],
  exports: [SequencesService],
})
export class SequencesModule {}
