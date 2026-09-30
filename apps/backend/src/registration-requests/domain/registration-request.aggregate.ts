import type {
  ApprovalExecutionStatus,
  RegistrationRequestAction,
  RegistrationRequestCommand,
  RegistrationRequestSafeEvent,
  RegistrationRequestSnapshot,
  RegistrationRequestStatus,
  RegistrationTransitionResult,
} from './registration-request.types.js';

type Transition = Readonly<{
  status: RegistrationRequestStatus;
  approvalExecutionStatus?: ApprovalExecutionStatus;
  eventAction: RegistrationRequestSafeEvent['action'];
}>;

export class RegistrationRequestDomainError extends Error {
  constructor(readonly code: 'STALE_VERSION' | 'TERMINAL_STATE' | 'INVALID_TRANSITION' | 'APPROVAL_NOT_READY', message: string) {
    super(message);
    this.name = 'RegistrationRequestDomainError';
  }
}

export class RegistrationRequestAggregate {
  private constructor(readonly snapshot: RegistrationRequestSnapshot) {}

  static from(snapshot: RegistrationRequestSnapshot): RegistrationRequestAggregate {
    if (!Number.isInteger(snapshot.version) || snapshot.version < 0) throw new RegistrationRequestDomainError('STALE_VERSION', 'Request version must be a non-negative integer');
    return new RegistrationRequestAggregate(Object.freeze({ ...snapshot }));
  }

  transition(command: RegistrationRequestCommand): RegistrationTransitionResult {
    if (command.expectedVersion !== this.snapshot.version) throw new RegistrationRequestDomainError('STALE_VERSION', 'Request version is stale');
    if (this.snapshot.status === 'APPROVED' || this.snapshot.status === 'REJECTED') {
      throw new RegistrationRequestDomainError('TERMINAL_STATE', `Registration request is terminal in ${this.snapshot.status}`);
    }
    const transition = this.resolve(command.action);
    const nextVersion = this.snapshot.version + 1;
    const nextSnapshot = Object.freeze({
      ...this.snapshot,
      status: transition.status,
      version: nextVersion,
      approvalExecutionStatus: transition.approvalExecutionStatus ?? this.snapshot.approvalExecutionStatus,
    });
    const event = Object.freeze({
      actorId: command.actorId,
      action: transition.eventAction,
      outcome: 'APPLIED' as const,
      priorStatus: this.snapshot.status,
      resultingStatus: nextSnapshot.status,
      requestVersion: nextVersion,
      ...(command.safeCategory === undefined ? {} : { safeCategory: command.safeCategory }),
    });
    return Object.freeze({ snapshot: nextSnapshot, event });
  }

  private resolve(action: RegistrationRequestAction): Transition {
    const status = this.snapshot.status;
    if (action === 'UPDATE' && (status === 'DRAFT' || status === 'REQUIRES_CORRECTION')) return { status, eventAction: 'UPDATED' };
    if (action === 'SUBMIT' && status === 'DRAFT') return { status: 'SUBMITTED', eventAction: 'SUBMITTED' };
    if (action === 'REQUEST_CORRECTION' && status === 'SUBMITTED') return { status: 'REQUIRES_CORRECTION', eventAction: 'CORRECTION_REQUESTED' };
    if (action === 'RESUBMIT' && status === 'REQUIRES_CORRECTION') return { status: 'SUBMITTED', eventAction: 'RESUBMITTED' };
    if (action === 'REJECT' && status === 'SUBMITTED') return { status: 'REJECTED', eventAction: 'REJECTED' };
    if (action === 'PREPARE_APPROVAL' && status === 'SUBMITTED' && this.snapshot.approvalExecutionStatus === 'NONE') {
      return { status: 'SUBMITTED', approvalExecutionStatus: 'PREPARED', eventAction: 'APPROVAL_PREPARED' };
    }
    if (action === 'FINALIZE_APPROVAL' && status === 'SUBMITTED') {
      if (this.snapshot.approvalExecutionStatus !== 'READY_TO_FINALIZE') {
        throw new RegistrationRequestDomainError('APPROVAL_NOT_READY', 'Approval execution must be READY_TO_FINALIZE');
      }
      return { status: 'APPROVED', approvalExecutionStatus: 'FINALIZED', eventAction: 'APPROVED' };
    }
    throw new RegistrationRequestDomainError('INVALID_TRANSITION', `${action} is not allowed from ${status}`);
  }
}
