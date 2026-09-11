import { Module } from '@nestjs/common';

import { DatabaseReadinessService } from './database-readiness.service.js';
import { PrismaService } from './prisma.service.js';

@Module({
  providers: [PrismaService, DatabaseReadinessService],
  exports: [PrismaService, DatabaseReadinessService],
})
export class DatabaseModule {}
