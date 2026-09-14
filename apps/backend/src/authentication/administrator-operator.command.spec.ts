import { describe, expect, it } from 'vitest';

import { AdministratorOperatorCommand } from './administrator-operator.command.js';

describe('AdministratorOperatorCommand', () => {
  it('requires an explicit confirmed interactive mode and never writes a supplied secret', async () => {
    const output: string[] = [];
    const command = new AdministratorOperatorCommand(
      { initialize: async () => ({ outcome: 'initialized' as const, identityId: '11111111-1111-1111-1111-111111111111' }) } as never,
      { recover: async () => ({ outcome: 'recovered' as const, identityId: '22222222-2222-2222-2222-222222222222' }) } as never,
    );
    const result = await command.run({
      interactive: true,
      selectMode: async () => 'initialize',
      readEmail: async () => 'first-admin@example.test',
      readHiddenPassword: async () => 'a-valid-operator-password',
      confirm: async () => true,
      write: (message) => output.push(message),
    });
    expect(result).toEqual({ exitCode: 0, category: 'initialized' });
    expect(output.join('\n')).not.toContain('a-valid-operator-password');
  });

  it('refuses non-interactive input and cancels before sending secrets to a service', async () => {
    const initialize = { initialize: async () => { throw new Error('must not initialize'); } } as never;
    const command = new AdministratorOperatorCommand(initialize, {} as never);
    const writes: string[] = [];
    await expect(command.run({ interactive: false, selectMode: async () => 'initialize', readEmail: async () => 'a@example.test', readHiddenPassword: async () => 'a-valid-operator-password', confirm: async () => true, write: (message) => writes.push(message) }))
      .resolves.toEqual({ exitCode: 2, category: 'refused' });
    expect(writes).toEqual(['operator-input-refused']);
  });
});
