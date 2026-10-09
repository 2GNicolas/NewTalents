import { Inject, Injectable } from '@nestjs/common';

import { PASSPORT_KEY_MATERIAL } from '../../player-passport/passport-key.token.js';
import { PassportTransactionRunner } from '../../player-passport/passport-lifecycle/transaction-runner.js';
import type { PassportKeyMaterial } from '../../player-passport/player-private-identity/passport-keys.js';
import { RegistrationAgePolicy } from '../personal/registration-age-policy.js';
import { AcademyOperationApprovalExecutor, type AcademyOperationApprovalInput } from './academy-operation-approval.shared.js';

@Injectable()
export class AcademyAdultPlayerApprovalOrchestrator {
  private readonly executor: AcademyOperationApprovalExecutor;
  constructor(runner: PassportTransactionRunner, ages: RegistrationAgePolicy, @Inject(PASSPORT_KEY_MATERIAL) keys: PassportKeyMaterial) { this.executor = new AcademyOperationApprovalExecutor(runner, ages, keys); }
  approve(input: AcademyOperationApprovalInput) { return this.executor.execute('ACADEMY_ADULT_PLAYER', input); }
}
