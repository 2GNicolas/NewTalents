import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { CustodyCommandCurrentState } from '../application/passport-custody-command.service.js';

export type PassportCustodyHttpErrorCode = 'validation' | 'forbidden' | 'not-found' | 'conflict' | 'idempotency-conflict' | 'unavailable';
export type PassportCustodyValidationIssue = Readonly<{ field: string; code: string }>;

export class PassportCustodyHttpError extends Error {
  constructor(
    readonly code: PassportCustodyHttpErrorCode,
    readonly issues: readonly PassportCustodyValidationIssue[] = [],
    readonly current?: CustodyCommandCurrentState,
  ) { super(code); }
}

type HttpResponse = { status(code: number): HttpResponse; json(body: unknown): void };

@Catch()
export class PassportCustodyExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    if (!(error instanceof PassportCustodyHttpError)) {
      response.status(500).json({ error: { code: 'passport_custody_internal_error', message: 'Passport custody could not be processed' } });
      return;
    }
    if (error.code === 'validation') {
      response.status(422).json({ error: { code: 'passport_custody_validation_failed', message: 'Passport custody validation failed' }, issues: error.issues });
      return;
    }
    if (error.code === 'conflict' || error.code === 'idempotency-conflict') {
      response.status(409).json({
        code: error.code === 'conflict' ? 'CUSTODY_CONFLICT' : 'IDEMPOTENCY_CONFLICT',
        message: error.code === 'conflict' ? 'Passport custody state changed' : 'Idempotency key belongs to another intention',
        current: error.current ?? { state: 'UNASSIGNED', version: 0 },
      });
      return;
    }
    const mapped = {
      forbidden: { status: 403, code: 'passport_custody_forbidden', message: 'Passport custody access denied' },
      'not-found': { status: 404, code: 'passport_custody_not_found', message: 'Passport custody resource not found' },
      unavailable: { status: 503, code: 'passport_custody_unavailable', message: 'Passport custody is temporarily unavailable' },
    } as const;
    const value = mapped[error.code];
    response.status(value.status).json({ error: { code: value.code, message: value.message } });
  }
}
