import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  parseApprovalCommand, parseCorrectionCommand, parseNaturalPersonAcademyCreate,
  parseRequestListQuery, parseTransitionCommand,
} from '../../src/registration-requests/http/registration-request.dto.js';

const contractPath = resolve(import.meta.dirname, '../../../../specs/006-registration-requests-approval/contracts/registration-requests.openapi.yaml');

describe('Feature 006 OpenAPI contract', () => {
  it('defines exactly 23 paths and 24 operations', async () => {
    const source = await readFile(contractPath, 'utf8');
    const pathsBlock = source.slice(source.indexOf('paths:'), source.indexOf('components:'));
    expect((pathsBlock.match(/^  \/[^:]+:/gm) ?? [])).toHaveLength(23);
    expect((pathsBlock.match(/^    (?:get|post|patch|delete):/gm) ?? [])).toHaveLength(24);
  });

  it('keeps all seven create payloads closed and evidence bytes multipart-only', async () => {
    const source = await readFile(contractPath, 'utf8');
    const schemas = ['PersonalAdultCreate', 'RepresentedMinorCreate', 'FormalAcademyCreate', 'NaturalPersonAcademyCreate', 'AdditionalAcademyAccountCreate', 'AcademyAdultPlayerCreate', 'AcademyMinorPlayerCreate', 'RequestUpdate'];
    for (let index = 0; index < schemas.length - 1; index += 1) {
      const schema = schemas[index]!;
      const start = source.indexOf(`    ${schema}:`);
      const next = source.indexOf(`    ${schemas[index + 1]}:`, start + 5);
      expect(source.slice(start, next)).toContain('additionalProperties: false');
    }
    expect(source).toContain('multipart/form-data');
    expect(source).toContain('format: binary');
    expect(source).not.toMatch(/application\/json[^\n]*(?:bytes|base64|objectKey|contentDigest|providerUrl)/i);
    expect(source).toContain('Authorized no-store document stream');
    const ordinaryResponses = source.slice(source.indexOf('    EvidenceMetadata:'), source.indexOf('    ValidationIssue:'));
    expect(ordinaryResponses).not.toMatch(/documentNumber|birthDate|password|encrypted|fingerprint|objectKey|contentDigest|providerUrl|base64|\bbytes\b/i);
  });

  it('defines cursor limits and safe non-enumerating error envelopes', async () => {
    const source = await readFile(contractPath, 'utf8');
    expect(source).toContain('minimum: 1, maximum: 50, default: 20');
    expect(source).toContain('SafeNotFound: {description: Missing or not authorized without existence disclosure');
    expect(source).toContain('SafeConflict: {description: Non-enumerating registration conflict');
  });

  it('enforces closed DTOs, exact limits, unique controlled arrays and commands', () => {
    expect(parseTransitionCommand({ expectedVersion: 0, idempotencyKey: '33333333-3333-4333-8333-333333333333', extra: true }).ok).toBe(false);
    expect(parseCorrectionCommand({ expectedVersion: 0, idempotencyKey: '33333333-3333-4333-8333-333333333333', safeReason: 'x'.repeat(1001), correctionTargets: ['IDENTITY'] }).ok).toBe(false);
    expect(parseApprovalCommand({ expectedVersion: 0, idempotencyKey: '33333333-3333-4333-8333-333333333333', manualDossierConfirmation: { confirmed: true, declarationVersion: 'x'.repeat(41), categories: ['RUT'] } }).ok).toBe(false);
    expect(parseNaturalPersonAcademyCreate({ credentials: { email: 'a@example.test', password: 'long-password-123', passwordConfirmation: 'long-password-123' }, academy: { academyName: 'A', country: 'CO', city: 'Bogota', responsiblePerson: { legalNames: 'A', legalSurnames: 'B', documentType: 'CC', documentNumber: '1', birthDate: '1990-01-01', country: 'CO', city: 'Bogota' } }, operationDeclared: true, proofCategories: ['RUT', 'RUT'], consent: { privacyVersion: 'v1', privacyAccepted: true, truthfulnessAccepted: true } }).ok).toBe(false);
    expect(parseRequestListQuery({ limit: '20' })).toEqual({ ok: true, value: { limit: 20 } });
    expect(parseRequestListQuery({ limit: '51' }).ok).toBe(false);
  });
});
