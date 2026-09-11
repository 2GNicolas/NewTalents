import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { BACKEND_RUNTIME_CONFIGURATION } from '../config/config.module.js';
import type { BackendRuntimeConfiguration } from '../config/environment.schema.js';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(BACKEND_RUNTIME_CONFIGURATION) configuration: BackendRuntimeConfiguration) {
    super({ adapter: new PrismaPg({ connectionString: configuration.databaseUrl }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
