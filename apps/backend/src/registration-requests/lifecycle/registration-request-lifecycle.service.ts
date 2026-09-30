import { Injectable } from '@nestjs/common';

import { RegistrationRequestAggregate, RegistrationRequestDomainError } from '../domain/registration-request.aggregate.js';
import type { RegistrationRequestAction, RegistrationRequestSnapshot, RegistrationTransitionResult } from '../domain/registration-request.types.js';
import type { RegistrationTypedDraftInput } from '../persistence/registration-request.repository.js';

export type LifecycleCommandInput = Readonly<{
  requestId: string;
  expectedVersion: number;
  actorId: string;
  idempotencyKey: string;
  safeCategory?: string;
}>;

export type LifecycleResult =
  | Readonly<{ outcome: 'created' | 'applied' | 'idempotent'; snapshot: RegistrationRequestSnapshot }>
  | Readonly<{ outcome: 'not-found' | 'stale' | 'invalid-transition' }>;

const SAFE_EVENT_CATEGORIES = new Set(['PROFILE', 'IDENTITY', 'EVIDENCE', 'SUBMISSION', 'ADMIN_DECISION', 'APPROVAL', 'SYSTEM']);

export interface RegistrationLifecycleRepository {
  createTypedDraft(input: RegistrationTypedDraftInput): Promise<RegistrationRequestSnapshot>;
  findSnapshot(requestId: string): Promise<RegistrationRequestSnapshot | null>;
  findIdempotentResult(input: Readonly<{ requestId: string; action: RegistrationRequestAction; idempotencyKey: string }>): Promise<RegistrationRequestSnapshot | null>;
  commitTransition(input: Readonly<{
    requestId: string;
    action: RegistrationRequestAction;
    expectedVersion: number;
    idempotencyKey: string;
    transition: RegistrationTransitionResult;
  }>): Promise<Readonly<{ outcome: 'applied'; snapshot: RegistrationRequestSnapshot }> | Readonly<{ outcome: 'idempotent'; snapshot: RegistrationRequestSnapshot }> | Readonly<{ outcome: 'stale' }>>;
}

@Injectable()
export class RegistrationRequestLifecycleService {
  constructor(private readonly repository: RegistrationLifecycleRepository) {}

  async createDraft(input: RegistrationTypedDraftInput): Promise<LifecycleResult> {
    return { outcome: 'created', snapshot: await this.repository.createTypedDraft(input) };
  }

  update(input: LifecycleCommandInput) { return this.execute('UPDATE', input); }
  submit(input: LifecycleCommandInput) { return this.execute('SUBMIT', input); }
  requestCorrection(input: LifecycleCommandInput) { return this.execute('REQUEST_CORRECTION', input); }
  resubmit(input: LifecycleCommandInput) { return this.execute('RESUBMIT', input); }
  reject(input: LifecycleCommandInput) { return this.execute('REJECT', input); }
  prepareApproval(input: LifecycleCommandInput) { return this.execute('PREPARE_APPROVAL', input); }
  finalizeApproval(input: LifecycleCommandInput) { return this.execute('FINALIZE_APPROVAL', input); }

  private async execute(action: RegistrationRequestAction, input: LifecycleCommandInput): Promise<LifecycleResult> {
    if (input.safeCategory !== undefined && !SAFE_EVENT_CATEGORIES.has(input.safeCategory)) return { outcome: 'invalid-transition' };
    const prior = await this.repository.findIdempotentResult({ requestId: input.requestId, action, idempotencyKey: input.idempotencyKey });
    if (prior) return { outcome: 'idempotent', snapshot: prior };
    const snapshot = await this.repository.findSnapshot(input.requestId);
    if (!snapshot) return { outcome: 'not-found' };
    if (snapshot.version !== input.expectedVersion) return { outcome: 'stale' };
    try {
      const transition = RegistrationRequestAggregate.from(snapshot).transition({
        action, expectedVersion: input.expectedVersion, actorId: input.actorId,
        ...(input.safeCategory === undefined ? {} : { safeCategory: input.safeCategory }),
      });
      return await this.repository.commitTransition({ requestId: input.requestId, action, expectedVersion: input.expectedVersion, idempotencyKey: input.idempotencyKey, transition });
    } catch (error) {
      if (error instanceof RegistrationRequestDomainError) {
        if (error.code === 'STALE_VERSION') return { outcome: 'stale' };
        return { outcome: 'invalid-transition' };
      }
      throw error;
    }
  }
}
