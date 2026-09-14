import { describe, expect, it } from 'vitest';

import { CredentialService } from './credential.service.js';

describe('CredentialService', () => {
  const service = new CredentialService();

  it('creates and verifies Argon2id PHC hashes with the approved parameters', async () => {
    const password = 'correct horse battery staple';
    const hash = await service.hashPassword(password);
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    await expect(service.verifyPassword(hash, password)).resolves.toBe(true);
    await expect(service.verifyPassword(hash, `${password}!`)).resolves.toBe(false);
  });

  it.each(['12345678901', 'a'.repeat(129), '', 1, null])('rejects passwords outside the exact 12-128 character boundary', async (password) => {
    await expect(service.hashPassword(password)).rejects.toThrow('Invalid credential input');
  });

  it('preserves exact Unicode input without normalization or truncation', async () => {
    const composed = 'pässword-1234';
    const decomposed = 'pa\u0308ssword-1234';
    const hash = await service.hashPassword(composed);
    await expect(service.verifyPassword(hash, composed)).resolves.toBe(true);
    await expect(service.verifyPassword(hash, decomposed)).resolves.toBe(false);
  });

  it('fails verification safely for invalid hash or password values', async () => {
    await expect(service.verifyPassword('not-a-phc-value', 'valid-password')).resolves.toBe(false);
    await expect(service.verifyPassword('$argon2id$bad', null)).resolves.toBe(false);
  });
});
