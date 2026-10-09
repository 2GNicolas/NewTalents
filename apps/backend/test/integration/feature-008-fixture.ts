import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';

import { AuthorizationService } from '../../src/authorization/authorization.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { AdministratorAllowanceAuthorization } from '../../src/passport-match-allowance/application/administrator-allowance-authorization.js';
import { AllowanceCommand } from '../../src/passport-match-allowance/application/allowance-command.js';
import { AllowanceTransactionRunner } from '../../src/passport-match-allowance/persistence/allowance-transaction.runner.js';

export function isolatedClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !/^newtalents_feature008_test_[a-f0-9]{12}$/.test(new URL(connectionString).pathname.slice(1))) {
    throw new Error('Feature 008 integration tests require an isolated database');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export async function fixture(prisma: PrismaClient, state: 'ACTIVE' | 'DRAFT' = 'ACTIVE') {
  const administratorId = randomUUID();
  const otherAdministratorId = randomUUID();
  const playerId = randomUUID();
  const passportId = randomUUID();
  await prisma.identity.createMany({ data: [{ id: administratorId }, { id: otherAdministratorId }] });
  await prisma.roleAssignment.createMany({ data: [administratorId, otherAdministratorId].map((identityId) => ({
    identityId, assignedByIdentityId: identityId, role: 'ADMINISTRATOR' as const,
  })) });
  await prisma.player.create({ data: { id: playerId } });
  await prisma.playerPassport.create({ data: { id: passportId, playerId, state, originKind: 'PARTICULAR',
    position: '', ageCategory: '', city: '', country: '', dominantFoot: 'UNDECLARED',
    createdByIdentityId: administratorId } });
  return { administratorId, otherAdministratorId, playerId, passportId };
}

export function command(prisma: PrismaClient, now: Date) {
  const authorization = new AdministratorAllowanceAuthorization(prisma as never, new AuthorizationService());
  return new AllowanceCommand(new AllowanceTransactionRunner(prisma as never, async () => undefined), authorization, () => now);
}
