import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';

export type RegistrationRequestHttpErrorCode =
  | 'validation' | 'not-found' | 'forbidden' | 'stale-version' | 'duplicate-conflict'
  | 'storage-unavailable' | 'scanner-unavailable' | 'deletion-retryable' | 'unsupported-evidence' | 'upload-too-large';

export type RegistrationValidationIssue = Readonly<{ field: string; code: string }>;

export class RegistrationRequestHttpError extends Error {
  constructor(readonly code: RegistrationRequestHttpErrorCode, readonly issues: readonly RegistrationValidationIssue[] = []) {
    super(code);
  }
}

type HttpResponse = { status(code: number): HttpResponse; json(body: unknown): void };

@Catch()
export class RegistrationRequestExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    if (!(error instanceof RegistrationRequestHttpError)) {
      response.status(500).json({ error: { code: 'registration_internal_error', message: 'Registration request could not be processed' } });
      return;
    }
    if (error.code === 'validation') {
      response.status(422).json({ error: { code: 'registration_validation_failed', message: 'Registration request validation failed' }, issues: error.issues.map(({ field, code }) => ({ field, code })) });
      return;
    }
    const mapping: Record<Exclude<RegistrationRequestHttpErrorCode, 'validation'>, Readonly<{ status: number; code: string; message: string }>> = {
      'not-found': { status: 404, code: 'registration_request_not_found', message: 'Registration request not found' },
      forbidden: { status: 404, code: 'registration_request_not_found', message: 'Registration request not found' },
      'stale-version': { status: 409, code: 'registration_request_version_conflict', message: 'Registration request version conflict' },
      'duplicate-conflict': { status: 409, code: 'registration_conflict', message: 'Registration request conflicts with an existing record' },
      'storage-unavailable': { status: 503, code: 'registration_service_unavailable', message: 'Registration service is temporarily unavailable' },
      'scanner-unavailable': { status: 503, code: 'registration_service_unavailable', message: 'Registration service is temporarily unavailable' },
      'deletion-retryable': { status: 503, code: 'registration_deletion_retryable', message: 'Evidence deletion requires retry' },
      'unsupported-evidence': { status: 415, code: 'registration_evidence_unsupported', message: 'Evidence type is unsupported' },
      'upload-too-large': { status: 413, code: 'registration_evidence_too_large', message: 'Evidence exceeds the configured size limit' },
    };
    const mapped = mapping[error.code];
    response.status(mapped.status).json({ error: { code: mapped.code, message: mapped.message } });
  }
}
