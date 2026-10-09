import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(fileURLToPath(new URL('../../../prisma/schema.prisma', import.meta.url)), 'utf8');

function model(name: string): string {
  const match = new RegExp(`model ${name} \\{([\\s\\S]*?)^\\}`, 'm').exec(schema);
  expect(match, `${name} must be declared`).not.toBeNull();
  return match![1]!;
}

describe('Feature 008 additive allowance schema shape', () => {
  it('declares only the four approved cadences', () => {
    expect(schema).toMatch(/enum MatchAllowanceCadence \{\s*MONTHLY\s+QUARTERLY\s+SEMIANNUAL\s+ANNUAL\s*\}/);
  });

  it('has one aggregate per existing passport with immutable date and version 1', () => {
    const allowance = model('PassportMatchAllowance');
    expect(allowance).toMatch(/passportId\s+String\s+@unique\s+@db\.Uuid/);
    expect(allowance).toMatch(/activatedOn\s+DateTime\s+@db\.Date/);
    expect(allowance).toMatch(/version\s+Int\s+@default\(1\)/);
    expect(allowance).toMatch(/passport\s+PlayerPassport\s+@relation\(fields: \[passportId\], references: \[id\], onDelete: Restrict\)/);
    expect(model('PlayerPassport')).toMatch(/matchAllowance\s+PassportMatchAllowance\?/);
  });

  it('declares append-only revision shape, actor and previous/new snapshots', () => {
    const revision = model('PassportMatchAllowanceRevision');
    expect(revision).toMatch(/allowanceId\s+String\s+@db\.Uuid/);
    expect(revision).toMatch(/sequence\s+Int/);
    expect(revision).toMatch(/idempotencyKey\s+String\s+@db\.Uuid/);
    expect(revision).toMatch(/cadence\s+MatchAllowanceCadence/);
    expect(revision).toMatch(/matchLimit\s+BigInt\s+@db\.BigInt/);
    expect(revision).toMatch(/effectiveOn\s+DateTime\s+@db\.Date/);
    expect(revision).toMatch(/previousCadence\s+MatchAllowanceCadence\?/);
    expect(revision).toMatch(/previousMatchLimit\s+BigInt\?\s+@db\.BigInt/);
    expect(revision).toMatch(/previousEffectiveOn\s+DateTime\?\s+@db\.Date/);
    expect(revision).toMatch(/confirmedByIdentityId\s+String\s+@db\.Uuid/);
    expect(revision).toMatch(/confirmedAt\s+DateTime\s+@default\(now\(\)\)/);
    expect(revision).toMatch(/supersededPendingRevision\s+Boolean\s+@default\(false\)/);
    expect(revision).toMatch(/@@unique\(\[allowanceId, sequence\]\)/);
    expect(revision).toMatch(/@@unique\(\[allowanceId, idempotencyKey\]\)/);
    expect(revision).toMatch(/allowance\s+PassportMatchAllowance\s+@relation\(fields: \[allowanceId\], references: \[id\], onDelete: Restrict\)/);
    expect(revision).toMatch(/administrator\s+Identity\s+@relation\("matchAllowanceRevisionActor", fields: \[confirmedByIdentityId\], references: \[id\], onDelete: Restrict\)/);
  });
});
