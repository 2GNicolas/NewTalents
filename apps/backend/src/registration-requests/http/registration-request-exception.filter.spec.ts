import { describe, expect, it, vi } from 'vitest';

import { RegistrationRequestExceptionFilter, RegistrationRequestHttpError } from './registration-request-exception.filter.js';

function host() {
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  return { response, host: { switchToHttp: () => ({ getResponse: () => response }) } };
}

describe('RegistrationRequestExceptionFilter', () => {
  it.each([
    ['not-found', 404, 'registration_request_not_found'],
    ['forbidden', 404, 'registration_request_not_found'],
    ['stale-version', 409, 'registration_request_version_conflict'],
    ['duplicate-conflict', 409, 'registration_conflict'],
    ['storage-unavailable', 503, 'registration_service_unavailable'],
    ['scanner-unavailable', 503, 'registration_service_unavailable'],
    ['deletion-retryable', 503, 'registration_deletion_retryable'],
  ] as const)('maps %s to a safe envelope', (code, status, safeCode) => {
    const target = host();
    new RegistrationRequestExceptionFilter().catch(new RegistrationRequestHttpError(code), target.host as never);
    expect(target.response.status).toHaveBeenCalledWith(status);
    expect(target.response.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: safeCode }) });
  });

  it('returns field-only validation issues and never serializes raw errors', () => {
    const target = host();
    new RegistrationRequestExceptionFilter().catch(new RegistrationRequestHttpError('validation', [{ field: 'details.city', code: 'too_big' }]), target.host as never);
    expect(target.response.json).toHaveBeenCalledWith({ error: { code: 'registration_validation_failed', message: 'Registration request validation failed' }, issues: [{ field: 'details.city', code: 'too_big' }] });
  });
});
