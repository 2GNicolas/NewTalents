import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const path = resolve(import.meta.dirname, '../../../../specs/008-admin-match-allowances/contracts/admin-passport-allowances.openapi.yaml');

describe('Feature 008 Administrator allowance contract', () => {
  it('defines only the all-passport/detail/allowance surface for this first slice', async () => {
    const source = await readFile(path, 'utf8');
    expect(source).toContain('/admin/passports:');
    expect(source).toContain('/admin/passports/{passportId}:');
    expect(source).toContain('/admin/passports/{passportId}/match-allowance:');
    expect(source).toMatch(/\/admin\/passports\/\{passportId\}\/match-allowance:\n    get:/);
    expect(source).toMatch(/\/admin\/passports\/\{passportId\}\/match-allowance:[\s\S]*?    put:/);
    expect(source).toContain('minimum: 1, maximum: 50, default: 20');
    expect(source).toContain('additionalProperties: false');
    expect(source).toContain('Cache-Control: {schema: {type: string, const: no-store}}');
  });

  it('uses a preview date, positive safe integer, idempotency and no usage or selected start date', async () => {
    const source = await readFile(path, 'utf8');
    const command = source.split('    AllowanceCommand:')[1]?.split('    Revision:')[0] ?? '';
    expect(command).toContain('expectedVersion');
    expect(command).toContain('idempotencyKey');
    expect(command).toContain('expectedActivationDate');
    expect(command).toContain('maximum: 9007199254740991');
    expect(command).not.toMatch(/startDate|used|available|scheduled/i);
    expect(source).toContain('enum: [ACCESS_DENIED, NOT_FOUND, ALLOWANCE_CONFLICT, IDEMPOTENCY_CONFLICT, ACTIVATION_DATE_CHANGED, INVALID_ALLOWANCE, PASSPORT_INELIGIBLE, ALLOWANCE_UNAVAILABLE]');
  });

  it('documents closed update commands, paginated read-only history and safe current-state conflicts', async () => {
    const source = await readFile(path, 'utf8');
    expect(source).toContain('/admin/passports/{passportId}/match-allowance/history:');
    expect(source).toContain('operationId: listPassportMatchAllowanceHistory');
    expect(source).toContain("then: {required: [expectedActivationDate]}");
    expect(source).toContain("else: {not: {required: [expectedActivationDate]}}");
    expect(source).toContain("current: {$ref: '#/components/schemas/AllowanceEnvelope'");
    expect(source).toContain('ALLOWANCE_UNAVAILABLE');
    expect(source).toContain("'503': {$ref: '#/components/responses/Unavailable'}");
  });
});
