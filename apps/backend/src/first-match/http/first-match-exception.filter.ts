import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';

export type FirstMatchErrorOutcome = 'not-found' | 'conflict' | 'invalid' | 'no-allowance'
  | 'allowance-full' | 'ineligible' | 'unavailable';

export class FirstMatchHttpError extends Error {
  constructor(readonly outcome: FirstMatchErrorOutcome) { super(outcome); }
}

const safe = {
  'not-found': { status: 404, code: 'FIRST_MATCH_NOT_FOUND', message: 'Resource not found' },
  conflict: { status: 409, code: 'FIRST_MATCH_CONFLICT', message: 'First match changed; refresh its state before retrying' },
  invalid: { status: 422, code: 'INVALID_MATCH', message: 'Match input is invalid' },
  'no-allowance': { status: 422, code: 'NO_ALLOWANCE', message: 'No allowance applies to the match date' },
  'allowance-full': { status: 422, code: 'ALLOWANCE_FULL', message: 'No allowance remains for the match date' },
  ineligible: { status: 422, code: 'PASSPORT_INELIGIBLE', message: 'Passport is not eligible' },
  unavailable: { status: 503, code: 'FIRST_MATCH_UNAVAILABLE', message: 'First match service is temporarily unavailable' },
} as const;

@Catch(FirstMatchHttpError)
export class FirstMatchExceptionFilter implements ExceptionFilter {
  catch(error: FirstMatchHttpError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      status(code: number): unknown; header(name: string, value: string): unknown; json(body: unknown): unknown;
    }>();
    const entry = safe[error.outcome];
    response.header('Cache-Control', 'no-store');
    response.status(entry.status);
    response.json({ code: entry.code, message: entry.message });
  }
}
