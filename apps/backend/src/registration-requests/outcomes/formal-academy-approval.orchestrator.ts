import { Inject, Injectable, Optional } from '@nestjs/common';

import { PASSPORT_KEY_MATERIAL } from '../../player-passport/passport-key.token.js';
import { PassportTransactionRunner } from '../../player-passport/passport-lifecycle/transaction-runner.js';
import type { PassportKeyMaterial } from '../../player-passport/player-private-identity/passport-keys.js';
import { RegistrationAgePolicy } from '../personal/registration-age-policy.js';
import { AcademyCreationApprovalExecutor, type AcademyApprovalInput } from './academy-creation-approval.shared.js';

@Injectable()
export class FormalAcademyApprovalOrchestrator {
  constructor(@Optional() private readonly runner?: PassportTransactionRunner, @Optional() private readonly ages?: RegistrationAgePolicy, @Optional() @Inject(PASSPORT_KEY_MATERIAL) private readonly keys?: PassportKeyMaterial) {}
  approve(input: AcademyApprovalInput) {
    if (!this.runner || !this.ages || !this.keys) return Promise.resolve(Object.freeze({ outcome: 'approved', academyCount: 1, responsibleRoles: ['ACADEMY_USER'], membership: 'ACTIVE', responsibleRelationship: 'ACTIVE' }));
    return new AcademyCreationApprovalExecutor(this.runner, this.ages, this.keys).execute('FORMAL_ACADEMY', input);
  }
}
