import { RequestMethod } from '@nestjs/common';
import { HEADERS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { AnalystPassportsController } from '../../src/passport-custody/http/analyst-passports.controller.js';
import { PassportCustodyController } from '../../src/passport-custody/http/passport-custody.controller.js';
import { AdminDossierController } from '../../src/registration-requests/http/admin-dossier.controller.js';
import { AdminRegistrationOperationsController } from '../../src/registration-requests/http/admin-registration-operations.controller.js';

const featureRoot = resolve(import.meta.dirname, '../../../../specs/007-administrator-requests-passport-custody');
const contractPath = resolve(featureRoot, 'contracts/admin-custody.openapi.yaml');

type Operation = Readonly<{ method: string; path: string; status: number }>;

describe('Feature 007 implementation contract alignment', () => {
  it('implements the 11 documented operations with their generated success status', async () => {
    const contract = await readFile(contractPath, 'utf8');
    const documented = contractOperations(contract).sort(byOperation);
    const implemented = [AdminRegistrationOperationsController, AdminDossierController, PassportCustodyController, AnalystPassportsController]
      .flatMap(implementationOperations)
      .sort(byOperation);

    expect(documented).toHaveLength(11);
    expect(implemented).toEqual(documented);
  });

  it('keeps every successful Feature 007 response no-store at runtime', () => {
    for (const controller of [AdminRegistrationOperationsController, AdminDossierController, PassportCustodyController, AnalystPassportsController]) {
      const prototype = controller.prototype as unknown as Record<string, Function>;
      for (const name of Object.getOwnPropertyNames(prototype)) {
        if (name === 'constructor') continue;
        const handler = prototype[name]!;
        if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
        const headers = (Reflect.getMetadata(HEADERS_METADATA, handler) as readonly Readonly<{ name: string; value: string }>[] | undefined) ?? [];
        expect(headers, `${controller.name}.${name}`).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
      }
    }
  });

  it('keeps closed parsers and safe errors wired without protected values', async () => {
    const sources = await Promise.all([
      'apps/backend/src/registration-requests/http/admin-registration-operations.dto.ts',
      'apps/backend/src/registration-requests/http/admin-dossier.dto.ts',
      'apps/backend/src/passport-custody/http/passport-custody.dto.ts',
      'apps/backend/src/passport-custody/http/analyst-passports.controller.ts',
      'apps/backend/src/registration-requests/http/admin-dossier.controller.ts',
      'apps/backend/src/passport-custody/http/passport-custody-exception.filter.ts',
    ].map((path) => readFile(resolve(import.meta.dirname, '../../../..', path), 'utf8')));
    const source = sources.join('\n');

    expect(source.match(/\.strict\(\)/g)?.length).toBeGreaterThanOrEqual(7);
    expect(source).toContain("'CUSTODY_CONFLICT'");
    expect(source).toContain("'IDEMPOTENCY_CONFLICT'");
    expect(source).toContain("'dossier_not_found'");
    expect(source).not.toMatch(/error\.(?:document|email|phone|credential|objectKey|contentDigest|evidence)/i);
  });

  it('does not introduce Feature 006 decisions or dossier/evidence mutations', async () => {
    const contract = await readFile(contractPath, 'utf8');
    const paths = contract.slice(contract.indexOf('paths:'), contract.indexOf('components:'));
    const operations = contractOperations(contract);

    expect(paths).not.toMatch(/^  \/admin\/dossiers\/[^\n]*(?:confirm|approve|delete|evidence)/im);
    expect(paths).not.toMatch(/^  \/admin\/passport-custody\/[^\n]*(?:approve|evidence|enrichment)/im);
    expect(operations.filter(({ path }) => path.startsWith('/admin/registration-requests/'))).toEqual([
      { method: 'GET', path: '/admin/registration-requests/operations', status: 200 },
      { method: 'PATCH', path: '/admin/registration-requests/{requestId}/review-progress', status: 200 },
    ]);
  });
});

function contractOperations(source: string): Operation[] {
  const lines = source.slice(source.indexOf('paths:'), source.indexOf('components:')).split(/\r?\n/);
  const operations: Operation[] = [];
  let path = '';
  for (let index = 0; index < lines.length; index += 1) {
    const pathMatch = /^  (\/[^:]+):$/.exec(lines[index]!);
    if (pathMatch) { path = pathMatch[1]!; continue; }
    const methodMatch = /^    (get|post|patch|delete):$/.exec(lines[index]!);
    if (!methodMatch) continue;
    const next = lines.slice(index + 1).findIndex((line) => /^    (?:get|post|patch|delete):$|^  \/[^:]+:$/.test(line));
    const block = lines.slice(index + 1, next < 0 ? undefined : index + 1 + next).join('\n');
    const status = /(?:^|\n)\s{6,}['"]?(2\d{2})['"]?:/.exec(block)?.[1];
    if (!status) throw new Error(`Missing success response for ${methodMatch[1]} ${path}`);
    operations.push({ method: methodMatch[1]!.toUpperCase(), path, status: Number(status) });
  }
  return operations;
}

function implementationOperations(controller: Function): Operation[] {
  const prefix = (Reflect.getMetadata(PATH_METADATA, controller) as string | undefined) ?? '';
  return Object.getOwnPropertyNames(controller.prototype).flatMap((name) => {
    if (name === 'constructor') return [];
    const handler = controller.prototype[name] as Function;
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    const route = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
    if (method === undefined || route === undefined) return [];
    const verb = RequestMethod[method];
    const path = `/${[prefix, route].filter(Boolean).join('/')}`.replace(/\/+/g, '/').replace(/\/$/, '').replace(/:([A-Za-z0-9_]+)/g, '{$1}');
    const status = (Reflect.getMetadata(HTTP_CODE_METADATA, handler) as number | undefined) ?? (verb === 'POST' ? 201 : 200);
    return [{ method: verb, path, status }];
  });
}

const byOperation = (left: Operation, right: Operation): number => `${left.path}:${left.method}`.localeCompare(`${right.path}:${right.method}`);
