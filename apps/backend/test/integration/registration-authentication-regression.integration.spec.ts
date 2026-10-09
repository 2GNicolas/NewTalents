import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthenticationService } from '../../src/authentication/authentication.service.js';
import { AuthenticationTransactionService } from '../../src/authentication/authentication-transaction.service.js';
import { CredentialService } from '../../src/authentication/credential.service.js';
import { RefreshTokenService } from '../../src/authentication/refresh-token.service.js';
import { SessionService } from '../../src/authentication/session.service.js';
import { TokenService } from '../../src/authentication/token.service.js';
import { parseBackendEnvironment } from '../../src/config/environment.schema.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { createApplication } from '../../src/main.js';

describe('Feature 006 authentication compatibility regression', () => {
  const configuration = parseBackendEnvironment(process.env);
  const prisma = new PrismaService(configuration);
  const credentials = new CredentialService();
  const transactions = new AuthenticationTransactionService(prisma, async () => undefined);
  const events = { record: async () => undefined } as never;
  const sessions = new SessionService(prisma, transactions, events);
  const tokens = new TokenService(configuration);
  const refreshes = new RefreshTokenService(prisma, transactions, tokens, events);
  const attempts = {
    throttled: async () => false,
    failed: async () => undefined,
    succeeded: async () => undefined,
  } as never;
  const authentication = new AuthenticationService(prisma, credentials, attempts, sessions, tokens, refreshes);
  const password = 'compatibility-password-2026';
  const email = `registration-auth-${randomUUID()}@example.test`;
  let identityId: string;
  let app: INestApplication;

  beforeAll(async () => {
    const identity = await prisma.identity.create({ data: { status: 'ACTIVE' } });
    identityId = identity.id;
    await prisma.roleAssignment.create({ data: { identityId, role: 'USER', status: 'ACTIVE', assignedByIdentityId: identityId } });
    await prisma.authenticationCredential.create({
      data: { identityId, normalizedEmail: email, passwordHash: await credentials.hashPassword(password), status: 'ACTIVE' },
    });
    app = await createApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await prisma.refreshTokenHistory.deleteMany({ where: { session: { identityId } } });
    await prisma.authenticationSession.deleteMany({ where: { identityId } });
    await prisma.authenticationCredential.deleteMany({ where: { identityId } });
    await prisma.roleAssignment.deleteMany({ where: { OR: [{ identityId }, { assignedByIdentityId: identityId }] } });
    await prisma.identity.delete({ where: { id: identityId } });
    await app.close();
    await prisma.$disconnect();
  });

  it('preserves login, refresh rotation, refresh-reuse revocation, logout, and logout-all', async () => {
    const firstLogin = await authentication.login({ email, password, source: { remoteAddress: '127.0.0.1' } });
    expect(firstLogin).toMatchObject({ outcome: 'authenticated', access: { classification: 'product' } });
    if (firstLogin.outcome !== 'authenticated') return;

    const rotated = await refreshes.rotate(firstLogin.refreshToken);
    expect(rotated).toMatchObject({ outcome: 'rotated', access: { classification: 'product' } });
    await expect(refreshes.rotate(firstLogin.refreshToken)).resolves.toEqual({ outcome: 'denied' });
    await expect(sessions.validate(identityId, firstLogin.sessionId)).resolves.toBe(false);

    const currentLogin = await authentication.login({ email, password, source: { remoteAddress: '127.0.0.1' } });
    expect(currentLogin.outcome).toBe('authenticated');
    if (currentLogin.outcome !== 'authenticated') return;
    await expect(sessions.logoutCurrent(identityId, currentLogin.sessionId)).resolves.toBe(true);
    await expect(sessions.validate(identityId, currentLogin.sessionId)).resolves.toBe(false);

    const allLoginOne = await authentication.login({ email, password, source: { remoteAddress: '127.0.0.1' } });
    const allLoginTwo = await authentication.login({ email, password, source: { remoteAddress: '127.0.0.1' } });
    expect(allLoginOne.outcome).toBe('authenticated');
    expect(allLoginTwo.outcome).toBe('authenticated');
    if (allLoginOne.outcome !== 'authenticated' || allLoginTwo.outcome !== 'authenticated') return;
    await expect(sessions.logoutAll(identityId)).resolves.toBe(true);
    await expect(sessions.validate(identityId, allLoginOne.sessionId)).resolves.toBe(false);
    await expect(sessions.validate(identityId, allLoginTwo.sessionId)).resolves.toBe(false);
  });

  it('keeps provisioning guarded and Administrator bootstrap/recovery outside the HTTP surface', async () => {
    await request(app.getHttpServer()).post('/auth/credentials/provision').send({ identityId }).expect(403);
    await request(app.getHttpServer()).post('/auth/credentials/reissue').send({ identityId }).expect(403);
    await request(app.getHttpServer()).post('/auth/administrator/initialize').send({}).expect(404);
    await request(app.getHttpServer()).post('/auth/administrator/recover').send({}).expect(404);
  });
});
