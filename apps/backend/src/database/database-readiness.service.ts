import { Inject, Injectable, Optional } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';

export type DatabaseReadiness = Readonly<{ status: 'ready' | 'unavailable' }>;

@Injectable()
export class DatabaseReadinessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Optional() private readonly timeoutMilliseconds = 5_000) {}

  async check(): Promise<DatabaseReadiness> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('readiness-timeout')), this.timeoutMilliseconds);
        }),
      ]);
      return { status: 'ready' };
    } catch {
      return { status: 'unavailable' };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
