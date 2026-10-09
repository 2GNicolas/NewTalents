import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const contractPath = resolve(
  import.meta.dirname,
  '../../../../specs/007-administrator-requests-passport-custody/contracts/admin-custody.openapi.yaml',
);

describe('Feature 007 Administrator custody OpenAPI contract', () => {
  it('defines exactly the 11 approved paths and 29 named schemas', async () => {
    const source = await readFile(contractPath, 'utf8');
    const paths = blockBetween(source, 'paths:', 'components:');
    const schemas = blockBetween(source, '  schemas:', '  responses:');

    expect(paths.match(/^  \/[^:]+:/gm) ?? []).toHaveLength(11);
    expect(paths.match(/^    (?:get|post|patch|delete):/gm) ?? []).toHaveLength(11);
    expect(schemas.match(/^    [A-Za-z][A-Za-z0-9]+:/gm) ?? []).toHaveLength(29);
  });

  it('keeps every object schema closed, including nested object alternatives', async () => {
    const source = await readFile(contractPath, 'utf8');
    const schemas = blockBetween(source, '  schemas:', '  responses:');
    const schemaLines = schemas.split(/\r?\n/);
    const objectDeclarations = schemaLines
      .map((line, index) => ({ index, match: line.match(/^(\s*)type: object\s*$/) }))
      .filter((entry): entry is { index: number; match: RegExpMatchArray } => entry.match !== null);

    expect(objectDeclarations.length).toBeGreaterThan(0);
    for (const declaration of objectDeclarations) {
      const indentation = declaration.match[1] ?? '';
      expect(schemaLines[declaration.index + 1], schemaLines[declaration.index]).toBe(
        `${indentation}additionalProperties: false`,
      );
    }
  });

  it('bounds pagination and custody reasons and marks successful protected responses no-store', async () => {
    const source = await readFile(contractPath, 'utf8');
    const paths = blockBetween(source, 'paths:', 'components:');

    expect(source).toContain(
      'Limit: {name: limit, in: query, schema: {type: integer, minimum: 1, maximum: 50, default: 20}}',
    );
    expect(source.match(/reason: \{type: string, minLength: 1, maxLength: 500\}/g) ?? []).toHaveLength(3);

    const inlineSuccessResponses = paths.match(/'200':\n(?: {10,}.*\n)+/g) ?? [];
    expect(inlineSuccessResponses.length).toBeGreaterThan(0);
    for (const response of inlineSuccessResponses) {
      expect(response).toContain("Cache-Control: {$ref: '#/components/headers/NoStore'}");
    }
    expect(source).toContain('NoStore: {schema: {type: string, const: no-store}}');
    expect(blockBetween(source, '    CustodyApplied:', '    CustodyConflict:')).toContain('NoStore');
    expect(blockBetween(source, '    CustodyConflict:', '    AuthenticationFailed:')).toContain('NoStore');
  });

  it('uses safe denial/conflict envelopes without protected candidate data', async () => {
    const source = await readFile(contractPath, 'utf8');
    const conflict = namedSchema(source, 'ConflictEnvelope');
    const safeDenied = blockBetween(source, '    SafeDenied:', '    SafeNotFound:');
    const safeNotFound = blockBetween(source, '    SafeNotFound:', '    VersionConflict:');

    expect(conflict).toContain('enum: [CUSTODY_CONFLICT, IDEMPOTENCY_CONFLICT]');
    expect(conflict).toContain("current: {$ref: '#/components/schemas/CustodySummary'}");
    expect(`${conflict}\n${safeDenied}\n${safeNotFound}`).not.toMatch(
      /document|credential|email|phone|fingerprint|objectKey|digest|evidence/i,
    );
    expect(safeDenied).toContain('without protected resource disclosure');
    expect(safeNotFound).toContain('indistinguishable');
  });

  it('keeps dossier operations read-only and exposes no evidence retrieval route', async () => {
    const source = await readFile(contractPath, 'utf8');
    const paths = blockBetween(source, 'paths:', 'components:');
    const dossierList = pathBlock(paths, '/admin/dossiers');
    const dossierDetail = pathBlock(paths, '/admin/dossiers/{dossierId}');

    for (const dossierPath of [dossierList, dossierDetail]) {
      expect(dossierPath).toMatch(/^    get:/m);
      expect(dossierPath).not.toMatch(/^    (?:post|put|patch|delete):/m);
    }
    expect(paths).not.toMatch(/^  \/admin\/dossiers\/[^\n]*(?:evidence|confirm|approve|delete)/im);
    expect(paths).not.toMatch(/^  \/admin\/passport-custody\/[^\n]*evidence/im);
  });
});

function blockBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Missing contract block ${startMarker} -> ${endMarker}`);
  return source.slice(start, end);
}

function namedSchema(source: string, name: string): string {
  const schemas = blockBetween(source, '  schemas:', '  responses:');
  const startMarker = `    ${name}:`;
  const start = schemas.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing schema ${name}`);
  const remainder = schemas.slice(start + startMarker.length);
  const next = remainder.search(/^    [A-Za-z][A-Za-z0-9]+:/m);
  return next === -1 ? remainder : remainder.slice(0, next);
}

function pathBlock(paths: string, path: string): string {
  const marker = `  ${path}:`;
  const start = paths.indexOf(marker);
  if (start < 0) throw new Error(`Missing path ${path}`);
  const remainder = paths.slice(start + marker.length);
  const next = remainder.search(/^  \/[^:]+:/m);
  return next === -1 ? remainder : remainder.slice(0, next);
}
