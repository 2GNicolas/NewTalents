import { describe, expect, it } from 'vitest';
import { AttemptControlService } from './attempt-control.service.js';
describe('AttemptControlService', () => {
  it('normalizes and digests identity/source keys without retaining plaintext', () => {
    const service = new AttemptControlService({} as never);
    expect(service.identityDigest(' User@Example.test ')).toMatch(/^[a-f0-9]{64}$/);
    expect(service.identityDigest(' User@Example.test ')).toBe(service.identityDigest('user@example.test'));
    expect(service.sourceAddress({ remoteAddress: '127.0.0.1', forwardedFor: '8.8.8.8' })).toBe('127.0.0.1');
  });
});
