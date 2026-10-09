import { RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { EvidenceStreamController } from '../../src/registration-requests/evidence/evidence-stream.controller.js';
import { AdminRegistrationReviewController } from '../../src/registration-requests/http/admin-registration-review.controller.js';
import { RegistrationRequestController } from '../../src/registration-requests/http/registration-request.controller.js';

const contractPath = resolve(import.meta.dirname, '../../../../specs/006-registration-requests-approval/contracts/registration-requests.openapi.yaml');
const sourcePaths = [
  resolve(import.meta.dirname, '../../src/registration-requests/http/registration-request.controller.ts'),
  resolve(import.meta.dirname, '../../src/registration-requests/http/admin-registration-review.controller.ts'),
  resolve(import.meta.dirname, '../../src/registration-requests/evidence/evidence-stream.controller.ts'),
  resolve(import.meta.dirname, '../../src/registration-requests/http/registration-request-exception.filter.ts'),
];

type Operation = Readonly<{ method: string; path: string; status: number }>;

function contractOperations(source: string): Operation[] {
  const lines = source.slice(source.indexOf('paths:'), source.indexOf('components:')).split(/\r?\n/);
  const operations: Operation[] = [];
  let path = '';
  for (let index = 0; index < lines.length; index += 1) {
    const pathMatch = /^  (\/[^:]+):$/.exec(lines[index]!);
    if (pathMatch) { path = pathMatch[1]!; continue; }
    const methodMatch = /^    (get|post|patch|delete):$/.exec(lines[index]!);
    if (!methodMatch) continue;
    const block = lines.slice(index + 1, index + 24).join('\n');
    const response = /responses:\s*(?:\n\s*)?\{?['"]?(\d{3})['"]?\s*:/.exec(block);
    if (!response) throw new Error(`Missing response status for ${methodMatch[1]} ${path}`);
    operations.push({ method: methodMatch[1]!.toUpperCase(), path, status: Number(response[1]) });
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
    const explicitStatus = Reflect.getMetadata(HTTP_CODE_METADATA, handler) as number | undefined;
    return [{ method: verb, path, status: explicitStatus ?? (verb === 'POST' ? 201 : 200) }];
  });
}

describe('Feature 006 OpenAPI implementation alignment', () => {
  it('implements every documented operation with the documented success status', async () => {
    const source = await readFile(contractPath, 'utf8');
    const documented = contractOperations(source).sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`));
    const implemented = [RegistrationRequestController, AdminRegistrationReviewController, EvidenceStreamController]
      .flatMap(implementationOperations)
      .sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`));
    expect(implemented).toEqual(documented);
    expect(implemented).toHaveLength(24);
  });

  it('keeps closed schema parsing, envelopes, multipart upload, streaming, and safe errors wired', async () => {
    const [applicant, admin, stream, filter] = await Promise.all(sourcePaths.map((path) => readFile(path, 'utf8')));
    for (const parser of [
      'parsePersonalAdultCreate', 'parseRepresentedMinorCreate', 'parseFormalAcademyCreate', 'parseNaturalPersonAcademyCreate',
      'parseAdditionalAcademyAccountCreate', 'parseAcademyAdultPlayerCreate', 'parseAcademyMinorPlayerCreate',
      'parseRequestUpdate', 'parseTransitionCommand', 'parseAdminRequestListQuery', 'parseCorrectionCommand', 'parseRejectionCommand', 'parseApprovalCommand',
    ]) expect(`${applicant}\n${admin}`).toContain(parser);
    expect(applicant).toContain('Busboy({ headers: request.headers');
    expect(applicant).toContain('return { data: result.evidence }');
    expect(applicant).toContain('pagination: { hasMore:');
    expect(admin).toContain('return { data: result.request }');
    expect(stream).toContain("response.setHeader('Cache-Control', 'no-store')");
    expect(stream).toContain("response.setHeader('X-Content-Type-Options', 'nosniff')");
    expect(stream).toContain('new StreamableFile(stream)');
    expect(filter).toContain("forbidden: { status: 404, code: 'registration_request_not_found'");
    expect(filter).not.toMatch(/candidate|fingerprint|documentNumber|objectKey|contentDigest|providerUrl|base64/i);
  });
});
