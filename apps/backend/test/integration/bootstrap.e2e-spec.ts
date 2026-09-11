import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

import { createApplication } from '../../src/main.js';
import { AcademyMembershipService } from '../../src/academy-membership/academy-membership.service.js';
import { AuthorizationService } from '../../src/authorization/authorization.service.js';
import { IdentityService } from '../../src/identity/identity.service.js';
import { PrivilegedChangesService } from '../../src/privileged-changes/privileged-changes.service.js';

describe('backend bootstrap', () => {
  let application: INestApplication | undefined;

  afterEach(async () => {
    await application?.close();
    application = undefined;
  });

  it('starts a listener and exposes no business route', async () => {
    application = await createApplication({ logger: false });
    await application.listen(0, '127.0.0.1');

    await request(application.getHttpServer()).get('/users').expect(404);
    expect(application.getHttpServer().listening).toBe(true);

    await application.close();
    expect(application.getHttpServer().listening).toBe(false);
    application = undefined;
  });

  it('composes Feature 002 internal services without exposing a business route', async () => {
    application = await createApplication({ logger: false });

    expect(application.get(IdentityService)).toBeInstanceOf(IdentityService);
    expect(application.get(AcademyMembershipService)).toBeInstanceOf(AcademyMembershipService);
    expect(application.get(AuthorizationService)).toBeInstanceOf(AuthorizationService);
    expect(application.get(PrivilegedChangesService)).toBeInstanceOf(PrivilegedChangesService);

    await application.listen(0, '127.0.0.1');
    await request(application.getHttpServer()).get('/identity').expect(404);
  });

  it('fails before listening when configuration is invalid', async () => {
    const originalPort = process.env.PORT;
    process.env.PORT = '__REQUIRED__';
    try {
      await expect(createApplication({ logger: false })).rejects.toThrow('PORT');
    } finally {
      process.env.PORT = originalPort;
    }
  });
});
