import { describe, expect, it } from 'vitest';
import { projectSessionAccess } from './session-access.projection.js';

describe('Feature 008 session capability projection', () => {
  it('projects Administrator passport capabilities only from an active assignment', () => {
    const roles = [{ role: 'ADMINISTRATOR', status: 'ACTIVE' }];
    expect(projectSessionAccess({ roleAssignments: roles }).capabilities).toEqual(expect.arrayContaining([
      'passport.allowance.list', 'passport.allowance.view', 'passport.allowance.read',
      'passport.allowance.write', 'passport.allowance.history',
    ]));
    expect(projectSessionAccess({ roleAssignments: [{ ...roles[0]!, status: 'REVOKED' }] }).capabilities)
      .not.toContain('passport.allowance.list');
    expect(projectSessionAccess({ roleAssignments: [{ role: 'ANALYST', status: 'ACTIVE' }] }).capabilities)
      .not.toContain('passport.allowance.list');
  });
});
