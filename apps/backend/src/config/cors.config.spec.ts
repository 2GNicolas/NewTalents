import { describe, expect, it } from 'vitest';

import { buildCorsOptions } from './cors.config.js';
import type { BackendRuntimeConfiguration } from './environment.schema.js';

const configuration = {
  allowedOrigins: ['http://localhost:8081', 'http://localhost:8082', 'http://localhost:19006'],
} as unknown as BackendRuntimeConfiguration;

describe('CORS configuration', () => {
  it('allows the configured Expo Web origin without enabling a wildcard', () => {
    const options = buildCorsOptions(configuration);

    expect(options.origin).toEqual(expect.arrayContaining(['http://localhost:8082']));
    expect(options.origin).not.toEqual(expect.arrayContaining(['*']));
    expect(options.credentials).toBe(false);
  });

  it('does not include an unapproved browser origin', () => {
    const options = buildCorsOptions(configuration);
    expect(options.origin).not.toEqual(expect.arrayContaining(['http://unapproved.example.test']));
  });
});
