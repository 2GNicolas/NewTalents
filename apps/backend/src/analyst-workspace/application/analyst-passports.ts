import { Injectable } from '@nestjs/common';

import { AnalystWorkspaceAccess } from './analyst-workspace-access.js';
import { AnalystWorkContact } from './analyst-work-contact.js';
import { AnalystPassportReadRepository } from '../persistence/analyst-passport-read.repository.js';

@Injectable()
export class AnalystPassports {
  constructor(private readonly access: AnalystWorkspaceAccess, private readonly passports: AnalystPassportReadRepository,
    private readonly contact: AnalystWorkContact) {}

  list(actorIdentityId: string, options: { limit: number; cursor?: string }) {
    return this.access.readCollection(actorIdentityId, (scope) => this.passports.list(scope, options, new Date()));
  }

  detail(actorIdentityId: string, passportId: string) {
    return this.access.readPassport(actorIdentityId, passportId, async (scope) => ({
      ...await this.passports.detail(scope, new Date()), contact: await this.contact.forPassport(scope),
    }));
  }
}
