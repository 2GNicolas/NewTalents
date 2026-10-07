import type { CustodyPassportSummary, EligibleAnalystSummary } from '../administrator-api';
import type { ConfirmedCustodyTransition } from './passport-custody-state';

export type CustodyConfirmationStage = 'idle' | 'selecting' | 'confirmation' | 'submitting' | 'applied' | 'conflict' | 'recoverable-error';
export type CustodyConfirmationAction = 'ASSIGN' | 'CHANGE' | 'REMOVE';
export type CustodyReasonError = 'required' | 'too-long';

type IdleSnapshot = Readonly<{ stage: 'idle' }>;
type SelectionSnapshot = Readonly<{ stage: 'selecting'; passport: CustodyPassportSummary; action: 'ASSIGN' | 'CHANGE' }>;
type IntentBase = Readonly<{
  stage: Exclude<CustodyConfirmationStage, 'idle' | 'selecting'>;
  passport: CustodyPassportSummary;
  idempotencyKey: string;
  conflictKind?: 'custody' | 'idempotency';
}>;
type AssignmentIntentSnapshot = IntentBase & Readonly<{ action: 'ASSIGN'; analyst: EligibleAnalystSummary }>;
type ReasonedIntent = IntentBase & Readonly<{ reason: string; reasonError?: CustodyReasonError }>;
type ChangeIntentSnapshot = ReasonedIntent & Readonly<{ action: 'CHANGE'; analyst: EligibleAnalystSummary }>;
type RemovalIntentSnapshot = ReasonedIntent & Readonly<{ action: 'REMOVE' }>;
type IntentSnapshot = AssignmentIntentSnapshot | ChangeIntentSnapshot | RemovalIntentSnapshot;

export type CustodyConfirmationSnapshot = IdleSnapshot | SelectionSnapshot | IntentSnapshot;
export type CustodyConfirmationResult = 'applied' | 'conflict' | 'idempotency-conflict' | 'denied' | 'failed' | 'invalid';
export type CustodyAssignmentExecutor = (input: ConfirmedCustodyTransition) => Promise<Exclude<CustodyConfirmationResult, 'invalid'>>;

const defaultUuid = (): string => globalThis.crypto?.randomUUID?.() ?? `00000000-0000-4000-8000-${Date.now().toString().padStart(12, '0').slice(-12)}`;

export class CustodyConfirmationState {
  private current: CustodyConfirmationSnapshot = Object.freeze({ stage: 'idle' });

  constructor(
    private readonly execute: CustodyAssignmentExecutor,
    private readonly createUuid: () => string = defaultUuid,
  ) {}

  get snapshot(): CustodyConfirmationSnapshot { return this.current; }

  beginAssignment(passport: CustodyPassportSummary): void {
    this.current = Object.freeze({ stage: 'selecting', passport, action: 'ASSIGN' });
  }

  beginChange(passport: CustodyPassportSummary): void {
    if (passport.custody.state !== 'ASSIGNED' || !passport.capabilities.includes('CHANGE')) return;
    this.current = Object.freeze({ stage: 'selecting', passport, action: 'CHANGE' });
  }

  beginRemoval(passport: CustodyPassportSummary): void {
    if (passport.custody.state !== 'ASSIGNED' || !passport.capabilities.includes('REMOVE')) return;
    this.current = Object.freeze({ stage: 'confirmation', passport, action: 'REMOVE', reason: '', idempotencyKey: this.createUuid() });
  }

  selectAnalyst(analyst: EligibleAnalystSummary): void {
    if (this.current.stage !== 'selecting') return;
    if (this.current.action === 'CHANGE' && this.current.passport.custody.state === 'ASSIGNED' && this.current.passport.custody.analyst.identityId === analyst.identityId) return;
    this.current = this.current.action === 'CHANGE'
      ? Object.freeze({ stage: 'confirmation', passport: this.current.passport, analyst, action: 'CHANGE', reason: '', idempotencyKey: this.createUuid() })
      : Object.freeze({ stage: 'confirmation', passport: this.current.passport, analyst, action: 'ASSIGN', idempotencyKey: this.createUuid() });
  }

  setReason(reason: string): void {
    if (!hasIntent(this.current) || this.current.action === 'ASSIGN' || this.current.reason === reason || this.current.stage === 'submitting') return;
    const { reasonError: _reasonError, ...intent } = this.current;
    this.current = Object.freeze({ ...intent, stage: 'confirmation', reason, idempotencyKey: this.createUuid() });
  }

  async confirm(): Promise<CustodyConfirmationResult> {
    if (!hasIntent(this.current) || !['confirmation', 'recoverable-error'].includes(this.current.stage)) return 'invalid';
    let reason: string | undefined;
    if (this.current.action !== 'ASSIGN') {
      reason = this.current.reason.trim();
      if (!reason) {
        this.current = Object.freeze({ ...this.current, stage: 'confirmation', reasonError: 'required' });
        return 'invalid';
      }
      if (reason.length > 500) {
        this.current = Object.freeze({ ...this.current, stage: 'confirmation', reasonError: 'too-long' });
        return 'invalid';
      }
    }
    const intent: IntentSnapshot = Object.freeze({ ...this.current, stage: 'submitting', ...(reason ? { reason } : {}) }) as IntentSnapshot;
    this.current = intent;
    const common = {
      passportId: intent.passport.passportId,
      expectedVersion: intent.passport.custody.version,
      idempotencyKey: intent.idempotencyKey,
    };
    const result = await this.execute(intent.action === 'REMOVE'
      ? { ...common, action: 'REMOVE', reason: intent.reason }
      : intent.action === 'CHANGE'
        ? { ...common, action: 'CHANGE', analystIdentityId: intent.analyst.identityId, reason: intent.reason }
        : { ...common, action: 'ASSIGN', analystIdentityId: intent.analyst.identityId });
    if (result === 'denied') {
      this.current = Object.freeze({ stage: 'idle' });
      return result;
    }
    this.current = Object.freeze({
      ...intent,
      stage: result === 'applied' ? 'applied' : result === 'conflict' || result === 'idempotency-conflict' ? 'conflict' : 'recoverable-error',
      ...(result === 'conflict' ? { conflictKind: 'custody' as const } : result === 'idempotency-conflict' ? { conflictKind: 'idempotency' as const } : {}),
    });
    return result;
  }

  retry(): Promise<CustodyConfirmationResult> {
    return this.current.stage === 'recoverable-error' ? this.confirm() : Promise.resolve('invalid');
  }

  cancel(): void { this.current = Object.freeze({ stage: 'idle' }); }
  dispose(): void { this.cancel(); }
}

export function hasCustodyConfirmationIntent(snapshot: CustodyConfirmationSnapshot): snapshot is IntentSnapshot {
  return !['idle', 'selecting'].includes(snapshot.stage);
}

const hasIntent = hasCustodyConfirmationIntent;
