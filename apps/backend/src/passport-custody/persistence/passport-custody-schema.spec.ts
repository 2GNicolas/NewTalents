import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(
  fileURLToPath(new URL('../../../prisma/schema.prisma', import.meta.url)),
  'utf8',
);

describe('Feature 007 passport custody Prisma schema', () => {
  it('declares exact review stages and custody actions', () => {
    expect(enumValues('RegistrationAdminReviewStage')).toEqual(['OPENED', 'REVIEWED']);
    expect(enumValues('PassportCustodyAction')).toEqual(['ASSIGNED', 'CHANGED', 'REMOVED']);
  });

  it('models one version-aware operational progress row per request', () => {
    const progress = modelBody('RegistrationAdminReviewProgress');

    expect(progress).toMatch(/\brequestId\s+String\s+@id\s+@db\.Uuid/);
    expect(progress).toMatch(/\bstage\s+RegistrationAdminReviewStage/);
    expect(progress).toMatch(/\bobservedRequestVersion\s+Int\b/);
    expect(progress).toMatch(/\bstartedByIdentityId\s+String\s+@db\.Uuid/);
    expect(progress).toMatch(/\blastUpdatedByIdentityId\s+String\s+@db\.Uuid/);
    expect(progress).toContain('onDelete: Restrict');
    expect(modelBody('RegistrationRequest')).toMatch(
      /\badminReviewProgress\s+RegistrationAdminReviewProgress\?/,
    );
  });

  it('models one minimum operational profile per identity', () => {
    const profile = modelBody('AnalystOperationalProfile');

    expect(profile).toMatch(/\bidentityId\s+String\s+@id\s+@db\.Uuid/);
    expect(profile).toMatch(/\bdisplayLabel\s+String\s+@db\.VarChar\(120\)/);
    expect(profile).toMatch(/\bnormalizedLabel\s+String\s+@db\.VarChar\(120\)/);
    expect(profile).toContain('onDelete: Restrict');
    expect(profile).toContain('@@index([normalizedLabel, identityId])');
    expect(modelBody('Identity')).toMatch(/\banalystOperationalProfile\s+AnalystOperationalProfile\?/);
  });

  it('stores at most one versioned current custody row per passport', () => {
    const custody = modelBody('PassportCustody');

    expect(custody).toMatch(/\bpassportId\s+String\s+@unique\s+@db\.Uuid/);
    expect(custody).toMatch(/\bcurrentAnalystIdentityId\s+String\?\s+@db\.Uuid/);
    expect(custody).toMatch(/\bversion\s+Int\s+@default\(0\)/);
    expect(custody).toMatch(/\bassignedAt\s+DateTime\?/);
    expect(custody.match(/onDelete: Restrict/g) ?? []).toHaveLength(2);
    expect(custody).toMatch(/@@index\(\[currentAnalystIdentityId, updatedAt, passportId\](?:, map: "[^"]+")?\)/);
    expect(custody).toContain('@@index([updatedAt, passportId])');
    expect(modelBody('PlayerPassport')).toMatch(/\bcustody\s+PassportCustody\?/);
  });

  it('defines immutable-shaped custody events with UUID idempotency and stable indexes', () => {
    const event = modelBody('PassportCustodyEvent');

    expect(event).toMatch(/\baction\s+PassportCustodyAction/);
    expect(event).toMatch(/\bpreviousAnalystIdentityId\s+String\?\s+@db\.Uuid/);
    expect(event).toMatch(/\bnextAnalystIdentityId\s+String\?\s+@db\.Uuid/);
    expect(event).toMatch(/\bsafeReason\s+String\?\s+@db\.VarChar\(500\)/);
    expect(event).toMatch(/\bexpectedVersion\s+Int\b/);
    expect(event).toMatch(/\bresultingVersion\s+Int\b/);
    expect(event).toMatch(/\bidempotencyKey\s+String\s+@unique\s+@db\.Uuid/);
    expect(event).not.toMatch(/\bupdatedAt\b/);
    expect(event).toContain('@@unique([passportId, sequence])');
    expect(event).toContain('@@index([passportId, createdAt, id])');
    expect(event).toContain('@@index([administratorIdentityId, createdAt])');
    expect(event.match(/onDelete: Restrict/g) ?? []).toHaveLength(4);
  });
});

function enumValues(name: string): string[] {
  const match = schema.match(new RegExp(`enum ${name} \\{([\\s\\S]*?)\\}`));
  if (!match?.[1]) throw new Error(`Missing enum ${name}`);
  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function modelBody(name: string): string {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!match?.[1]) throw new Error(`Missing model ${name}`);
  return match[1];
}
