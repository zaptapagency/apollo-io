import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DealsService } from './deals.service';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [PrismaModule],
  providers: [DealsService, PipelineService],
  exports: [DealsService, PipelineService],
})
export class CrmModule {}
