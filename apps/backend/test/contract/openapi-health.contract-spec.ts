import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('health OpenAPI contract', () => {
  it('defines the implemented closed liveness and readiness surface', () => {
    const contract = readFileSync(resolve(process.cwd(), '../../specs/001-project-runtime-foundation/contracts/health.openapi.yaml'), 'utf8');
    expect(contract).toContain('/health/live:');
    expect(contract).toContain('/health/ready:');
    expect(contract).toContain('const: no-store');
    expect(contract).toContain('const: ok');
    expect(contract).toContain('const: ready');
    expect(contract).toContain('const: unavailable');
    expect(contract.match(/additionalProperties: false/g)).toHaveLength(3);
    expect(contract).not.toMatch(/^\s{2}\/(?!health\/(?:live|ready):)/m);
  });
});
