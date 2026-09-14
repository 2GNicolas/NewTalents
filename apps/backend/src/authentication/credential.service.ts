import * as argon2 from 'argon2';
import { Injectable } from '@nestjs/common';

export const ARGON2ID_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
});

const validPassword = (value: unknown): value is string => typeof value === 'string' && value.length >= 12 && value.length <= 128;

@Injectable()
export class CredentialService {
  async hashPassword(password: unknown): Promise<string> {
    if (!validPassword(password)) throw new Error('Invalid credential input');
    return argon2.hash(password, ARGON2ID_OPTIONS);
  }

  async verifyPassword(hash: unknown, password: unknown): Promise<boolean> {
    if (typeof hash !== 'string' || !validPassword(password)) return false;
    try { return await argon2.verify(hash, password); } catch { return false; }
  }

  validPassword(value: unknown): value is string { return validPassword(value); }
}
