import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient } from '../../src/generated/prisma/client.js';
import { RegistrationRequestLifecycleService } from '../../src/registration-requests/lifecycle/registration-request-lifecycle.service.js';
import { RegistrationRequestRepository } from '../../src/registration-requests/persistence/registration-request.repository.js';
import { RegistrationExactConflictService } from '../../src/registration-requests/duplicates/registration-exact-conflict.service.js';
import { PrivateIdentityService } from '../../src/player-passport/player-private-identity/private-identity.service.js';

const connectionString = process.env.DATABASE_URL!;
const clients = [
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) }),
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) }),
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) }),
] as const;
const requestIds: string[] = [];
const identityIds: string[] = [];
const keys = { documentHmacKey: Buffer.alloc(32, 41), nameDobHmacKey: Buffer.alloc(32, 42), privateEncryptionKey: Buffer.alloc(32, 43) };

const applicant = { encryptedLegalName: 'synthetic', encryptedDateOfBirth: 'synthetic', encryptedDocumentType: 'synthetic', encryptedDocumentNumber: 'synthetic', documentFingerprint: '', nameDobFingerprint: '', derivedAdult: true };
const player = { encryptedLegalName: 'synthetic', encryptedDateOfBirth: 'synthetic', encryptedDocumentType: 'synthetic', encryptedDocumentNumber: 'synthetic', documentFingerprint: '', nameDobFingerprint: '', encryptedCountry: 'synthetic', encryptedCity: 'synthetic', derivedAdult: true };

async function fixture(status: 'DRAFT' | 'REQUIRES_CORRECTION' | 'SUBMITTED') {
  const ownerIdentityId = randomUUID();
  const requestId = randomUUID();
  identityIds.push(ownerIdentityId);
  requestIds.push(requestId);
  await clients[0].identity.create({ data: { id: ownerIdentityId } });
  const repository = new RegistrationRequestRepository(clients[0] as never);
  await repository.createTypedDraft({
    requestId, ownerIdentityId, type: 'PERSONAL_ADULT',
    detail: { type: 'PERSONAL_ADULT', applicant: { ...applicant, documentFingerprint: `a-${requestId}`, nameDobFingerprint: `an-${requestId}` }, player: { ...player, documentFingerprint: `p-${requestId}`, nameDobFingerprint: `pn-${requestId}` }, actingForSelf: true },
  });
  if (status !== 'DRAFT') await clients[0].registrationRequest.update({ where: { id: requestId }, data: { status } });
  return { requestId, ownerIdentityId };
}

function lifecycle(index: 0 | 1 | 2) { return new RegistrationRequestLifecycleService(new RegistrationRequestRepository(clients[index] as never)); }

describe('Feature 006 registration lifecycle concurrency', () => {
  beforeAll(async () => { await Promise.all(clients.map((client) => client.$queryRaw`SELECT 1`)); });
  afterAll(async () => {
    await clients[0].$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
      if (requestIds.length) {
        await transaction.registrationExactIdentifierClaim.deleteMany({ where: { requestId: { in: requestIds } } });
        await transaction.registrationRequestIdempotencyRecord.deleteMany({ where: { requestId: { in: requestIds } } });
        await transaction.registrationRequestEvent.deleteMany({ where: { requestId: { in: requestIds } } });
        await transaction.personalAdultRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } });
        await transaction.registrationRequestApplicant.deleteMany({ where: { requestId: { in: requestIds } } });
        await transaction.registrationRequestPlayer.deleteMany({ where: { requestId: { in: requestIds } } });
        await transaction.registrationRequest.deleteMany({ where: { id: { in: requestIds } } });
      }
      if (identityIds.length) await transaction.identity.deleteMany({ where: { id: { in: identityIds } } });
    });
    await Promise.all(clients.map((client) => client.$disconnect()));
  });

  it.each([
    ['submit', 'DRAFT'],
    ['resubmit', 'REQUIRES_CORRECTION'],
  ] as const)('allows exactly one racing %s for the current version', async (action, status) => {
    const fixtureData = await fixture(status);
    const commands = ([0, 1] as const).map((index) => lifecycle(index)[action]({ requestId: fixtureData.requestId, expectedVersion: 0, actorId: fixtureData.ownerIdentityId, idempotencyKey: randomUUID(), safeCategory: 'SUBMISSION' }));
    const results = await Promise.all(commands);
    expect(results.filter((result) => result.outcome === 'applied')).toHaveLength(1);
    expect(results.filter((result) => result.outcome === 'stale')).toHaveLength(1);
    expect(await clients[0].registrationRequestEvent.count({ where: { requestId: fixtureData.requestId } })).toBe(1);
  });

  it('serializes correction, approval preparation and rejection on the same submitted version', async () => {
    const fixtureData = await fixture('SUBMITTED');
    const command = { requestId: fixtureData.requestId, expectedVersion: 0, actorId: fixtureData.ownerIdentityId, idempotencyKey: randomUUID(), safeCategory: 'ADMIN_DECISION' as const };
    const results = await Promise.all([
      lifecycle(0).requestCorrection(command),
      lifecycle(1).prepareApproval({ ...command, idempotencyKey: randomUUID(), safeCategory: 'APPROVAL' }),
      lifecycle(2).reject({ ...command, idempotencyKey: randomUUID() }),
    ]);
    expect(results.filter((result) => result.outcome === 'applied')).toHaveLength(1);
    expect(results.filter((result) => result.outcome === 'stale')).toHaveLength(2);
    expect(await clients[0].registrationRequestEvent.count({ where: { requestId: fixtureData.requestId } })).toBe(1);
    expect(await clients[0].registrationRequestIdempotencyRecord.count({ where: { requestId: fixtureData.requestId } })).toBe(1);
    expect(await clients[0].registrationReviewDecision.count({ where: { requestId: fixtureData.requestId } })).toBe(0);
    expect(await clients[0].registrationApprovalExecution.count({ where: { requestId: fixtureData.requestId } })).toBe(0);
  });

  it('allows at most one racing request creation for the same normalized document', async () => {
    const requestPair = [randomUUID(), randomUUID()] as const;
    requestIds.push(...requestPair);
    const documentNumber = String(Date.now()).slice(-10);
    const stored = new PrivateIdentityService(keys).createPrivateIdentity({ legalName: 'Persona Sintética', dateOfBirth: '1990-01-01', documentType: 'CC', documentNumber });
    const identifiers = { documents: [{ field: 'person.documentNumber', documentType: 'CC', documentNumber }] } as const;
    const attempt = async (index: 0 | 1, requestId: string) => {
      try {
        return await clients[index].$transaction(async (transaction) => {
          const service = new RegistrationExactConflictService(clients[index] as never, keys);
          const result = await service.inspect(transaction, identifiers);
          if (result.outcome === 'conflict') return result;
          await new RegistrationRequestRepository(clients[index] as never).createTypedDraftInTransaction(transaction, {
            requestId, type: 'PERSONAL_ADULT', detail: {
              type: 'PERSONAL_ADULT', applicant: { ...applicant, ...stored }, player: { ...player, ...stored, encryptedCountry: 'synthetic', encryptedCity: 'synthetic' }, actingForSelf: true,
            },
          });
          const reserved = await service.reserve(transaction, identifiers, requestId);
          if (reserved.outcome === 'conflict') throw Object.assign(new Error('EXACT_IDENTIFIER_CONFLICT'), { code: 'EXACT_IDENTIFIER_CONFLICT', field: reserved.field });
          return reserved;
        }, { isolationLevel: 'ReadCommitted' });
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'EXACT_IDENTIFIER_CONFLICT') return { outcome: 'conflict' as const, field: String('field' in error ? error.field : 'documentNumber') };
        throw error;
      }
    };
    const results = await Promise.all([attempt(0, requestPair[0]), attempt(1, requestPair[1])]);
    expect(results.filter((result) => result.outcome === 'clear')).toHaveLength(1);
    expect(results.filter((result) => result.outcome === 'conflict')).toHaveLength(1);
    expect(await clients[0].registrationRequest.count({ where: { id: { in: [...requestPair] } } })).toBe(1);
  });
});
