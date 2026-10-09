import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';

export type AllowanceHttpErrorCode = 'invalid' | 'denied' | 'not-found' | 'conflict' | 'idempotency-conflict' | 'activation-date-changed' | 'ineligible' | 'unavailable';

export class AdminAllowanceHttpError extends Error {
  constructor(readonly code: AllowanceHttpErrorCode, readonly current?: Readonly<{ colombiaToday: string; configuration: unknown }>) { super(code); }
}

const safe = {
  invalid: { status: 422, code: 'INVALID_ALLOWANCE', message: 'Allowance input is invalid' },
  denied: { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' },
  'not-found': { status: 404, code: 'NOT_FOUND', message: 'Resource not found' },
  conflict: { status: 409, code: 'ALLOWANCE_CONFLICT', message: 'Allowance state changed; refresh before confirming' },
  'idempotency-conflict': { status: 409, code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key belongs to another intention' },
  'activation-date-changed': { status: 409, code: 'ACTIVATION_DATE_CHANGED', message: 'Colombia activation day changed; refresh before confirming' },
  ineligible: { status: 422, code: 'PASSPORT_INELIGIBLE', message: 'Passport is not eligible' },
  unavailable: { status: 503, code: 'ALLOWANCE_UNAVAILABLE', message: 'Allowance service is temporarily unavailable' },
} as const;

@Catch()
export class AdminAllowanceExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      status(code: number): unknown;
      header(name: string, value: string): unknown;
      json(body: unknown): unknown;
    }>();
    const entry = error instanceof AdminAllowanceHttpError ? safe[error.code]
      : error instanceof HttpException && [401, 403].includes(error.getStatus()) ? safe.denied : safe.unavailable;
    response.header('Cache-Control', 'no-store');
    response.status(entry.status);
    const current = error instanceof AdminAllowanceHttpError && ['conflict', 'idempotency-conflict'].includes(error.code) ? error.current : undefined;
    response.json({ code: entry.code, message: entry.message, ...(current ? { current } : {}) });
  }
}
