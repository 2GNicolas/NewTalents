import { Injectable } from '@nestjs/common';

import { EvidenceDeletionService } from './evidence-deletion.service.js';

@Injectable()
export class EvidenceDeletionWorker {
  constructor(private readonly deletion: EvidenceDeletionService) {}

  async runOnce(now = new Date()): Promise<Readonly<{ claimed: number; completed: number; deferred: number; recoveryRequired: number }>> {
    const claimed = await this.deletion.claimBatch(now);
    let completed = 0;
    let deferred = 0;
    let recoveryRequired = 0;
    for (const recordId of claimed) {
      const result = await this.deletion.processClaimed(recordId);
      if (result.outcome === 'completed') completed += 1;
      else if (result.outcome === 'recovery-required') recoveryRequired += 1;
      else deferred += 1;
    }
    return { claimed: claimed.length, completed, deferred, recoveryRequired };
  }
}
