import { Inject, Injectable } from '@nestjs/common';

import { PASSPORT_KEY_MATERIAL } from '../../player-passport/passport-key.token.js';
import { PassportTransactionRunner } from '../../player-passport/passport-lifecycle/transaction-runner.js';
import type { PassportKeyMaterial } from '../../player-passport/player-private-identity/passport-keys.js';
import { RegistrationAgePolicy } from '../personal/registration-age-policy.js';
import { PersonalApprovalExecutor, type PersonalApprovalInput } from './personal-approval.shared.js';

@Injectable()
export class RepresentedMinorApprovalOrchestrator {
  private readonly executor: PersonalApprovalExecutor;
  constructor(runner: PassportTransactionRunner, agePolicy: RegistrationAgePolicy, @Inject(PASSPORT_KEY_MATERIAL) keys: PassportKeyMaterial) {
    this.executor = new PersonalApprovalExecutor(runner, agePolicy, keys);
  }
  approve(input: PersonalApprovalInput) { return this.executor.execute('REPRESENTED_MINOR', input); }
}
