import { createHash } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

type Source = Readonly<{ remoteAddress?: unknown; forwardedFor?: unknown }>;
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
export const ATTEMPT_CLOCK = Symbol('ATTEMPT_CLOCK');
export const ATTEMPT_TRUSTED_PROXY = Symbol('ATTEMPT_TRUSTED_PROXY');
@Injectable()
export class AttemptControlService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(ATTEMPT_CLOCK) private readonly now: () => Date = () => new Date(),
    @Optional() @Inject(ATTEMPT_TRUSTED_PROXY) private readonly trustedProxy = false,
  ) {}
  identityDigest(email: unknown): string { return digest(typeof email === 'string' ? email.trim().toLowerCase() : ''); }
  sourceAddress(source: Source): string {
    const direct = typeof source.remoteAddress === 'string' ? source.remoteAddress : '';
    if (!this.trustedProxy || typeof source.forwardedFor !== 'string') return direct;
    const forwarded = source.forwardedFor.split(',').map((value) => value.trim()).filter(Boolean);
    return forwarded.length === 1 ? forwarded[0]! : direct;
  }
  async throttled(email: unknown, source: Source): Promise<boolean> {
    const now = this.now(); const identity = this.identityDigest(email); const address = digest(this.sourceAddress(source));
    const record = await this.prisma.authenticationAttempt.findFirst({ where: { clearedAt: null, windowEndsAt: { gt: now }, OR: [{ normalizedIdentityKeyDigest: identity }, { sourceAddressKeyDigest: address }] }, orderBy: { failureCount: 'desc' } });
    return Boolean(record && record.failureCount >= 5);
  }
  async failed(email: unknown, source: Source): Promise<void> {
    const now = this.now(); const identity = this.identityDigest(email); const address = digest(this.sourceAddress(source));
    const current = await this.prisma.authenticationAttempt.findFirst({ where: { normalizedIdentityKeyDigest: identity, sourceAddressKeyDigest: address, clearedAt: null, windowEndsAt: { gt: now } } });
    if (current) { await this.prisma.authenticationAttempt.update({ where: { id: current.id }, data: { failureCount: { increment: 1 } } }); return; }
    await this.prisma.authenticationAttempt.create({ data: { normalizedIdentityKeyDigest: identity, sourceAddressKeyDigest: address, failureCount: 1, windowStartedAt: now, windowEndsAt: new Date(now.getTime() + 900_000), expiresAt: new Date(now.getTime() + 900_000 + 86_400_000) } });
  }
  async succeeded(email: unknown, source: Source): Promise<void> { const identity = this.identityDigest(email); const address = digest(this.sourceAddress(source)); await this.prisma.authenticationAttempt.updateMany({ where: { clearedAt: null, OR: [{ normalizedIdentityKeyDigest: identity }, { sourceAddressKeyDigest: address }] }, data: { clearedAt: this.now() } }); }
}
