import { Injectable } from '@nestjs/common';

import { DatabaseReadinessService } from '../database/database-readiness.service.js';

@Injectable()
export class ReadinessService {
  constructor(private readonly database: DatabaseReadinessService) {}
  async check(): Promise<{ status: 'ready' | 'unavailable' }> { return this.database.check(); }
}
