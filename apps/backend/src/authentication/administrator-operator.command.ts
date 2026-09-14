import { stdin as input, stdout as output } from 'node:process';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { RuntimeConfigModule } from '../config/config.module.js';
import { AuthenticationModule } from './authentication.module.js';
import { AdministratorBootstrapService } from './administrator-bootstrap.service.js';
import { AdministratorRecoveryService } from './administrator-recovery.service.js';

export type AdministratorOperatorMode = 'initialize' | 'recover';
export type AdministratorOperatorTerminal = Readonly<{
  interactive: boolean;
  selectMode: () => Promise<AdministratorOperatorMode | undefined>;
  readEmail: () => Promise<string | undefined>;
  readHiddenPassword: () => Promise<string | undefined>;
  confirm: () => Promise<boolean>;
  write: (message: string) => void;
}>;
export type AdministratorOperatorCommandResult = Readonly<{ exitCode: 0 | 1 | 2; category: 'initialized' | 'recovered' | 'refused' | 'cancelled' | 'failed' }>;

@InjectableOperatorModule()
class AdministratorOperatorModule {}

function InjectableOperatorModule(): ClassDecorator {
  return Module({ imports: [RuntimeConfigModule, AuthenticationModule] });
}

export class AdministratorOperatorCommand {
  constructor(
    private readonly bootstrap: AdministratorBootstrapService,
    private readonly recovery: AdministratorRecoveryService,
  ) {}

  async run(terminal: AdministratorOperatorTerminal): Promise<AdministratorOperatorCommandResult> {
    if (!terminal.interactive) return this.write(terminal, { exitCode: 2, category: 'refused' }, 'operator-input-refused');
    const mode = await terminal.selectMode();
    const email = await terminal.readEmail();
    const password = await terminal.readHiddenPassword();
    if (!mode || !email || !password) return this.write(terminal, { exitCode: 2, category: 'cancelled' }, 'operator-cancelled');
    terminal.write(`operator-${mode} ${email}`);
    const confirmation = await terminal.confirm();
    if (!confirmation) return this.write(terminal, { exitCode: 2, category: 'cancelled' }, 'operator-cancelled');
    const result = mode === 'initialize'
      ? await this.bootstrap.initialize({ confirmation, email, password })
      : await this.recovery.recover({ confirmation, email, password });
    if (result.outcome === 'initialized') return this.write(terminal, { exitCode: 0, category: 'initialized' }, `administrator-initialized ${result.identityId}`);
    if (result.outcome === 'recovered') return this.write(terminal, { exitCode: 0, category: 'recovered' }, `administrator-recovered ${result.identityId}`);
    if (result.outcome === 'refused' || result.outcome === 'invalid') return this.write(terminal, { exitCode: 2, category: 'refused' }, 'operator-refused');
    return this.write(terminal, { exitCode: 1, category: 'failed' }, 'operator-failed');
  }

  private write(terminal: AdministratorOperatorTerminal, result: AdministratorOperatorCommandResult, message: string): AdministratorOperatorCommandResult {
    terminal.write(message);
    return result;
  }
}

export async function runAdministratorOperatorCommand(terminal: AdministratorOperatorTerminal): Promise<AdministratorOperatorCommandResult> {
  if (!terminal.interactive) {
    terminal.write('operator-input-refused');
    return { exitCode: 2, category: 'refused' };
  }
  const context = await NestFactory.createApplicationContext(AdministratorOperatorModule, { abortOnError: false, logger: ['error', 'warn'] });
  try {
    return await new AdministratorOperatorCommand(context.get(AdministratorBootstrapService), context.get(AdministratorRecoveryService)).run(terminal);
  } catch {
    terminal.write('operator-failed');
    return { exitCode: 1, category: 'failed' };
  } finally {
    await context.close();
  }
}

export function createProcessTerminal(mode: string | undefined = process.argv[2]): AdministratorOperatorTerminal {
  const interactive = Boolean(input.isTTY && output.isTTY);
  const question = async (prompt: string): Promise<string | undefined> => {
    if (!interactive) return undefined;
    const terminal = createInterface({ input, output, terminal: true });
    try { return (await terminal.question(prompt)).trim() || undefined; } finally { terminal.close(); }
  };
  return {
    interactive,
    selectMode: async () => mode === 'initialize' || mode === 'recover' ? mode : undefined,
    readEmail: () => question('Administrator email: '),
    readHiddenPassword: async () => {
      if (!interactive || !input.isTTY) return undefined;
      output.write('Administrator password: ');
      return await new Promise<string | undefined>((resolve) => {
        let value = '';
        const complete = () => {
          input.off('data', onData);
          input.setRawMode(false);
          input.pause();
          output.write('\n');
          resolve(value || undefined);
        };
        const onData = (chunk: Buffer) => {
          const character = chunk.toString('utf8');
          if (character === '\r' || character === '\n') return complete();
          if (character === '\u0003') { value = ''; return complete(); }
          if (character === '\b' || character === '\u007f') { value = value.slice(0, -1); return; }
          value += character;
        };
        input.setRawMode(true);
        input.resume();
        input.on('data', onData);
      });
    },
    confirm: async () => (await question('Type CONFIRM to continue: ')) === 'CONFIRM',
    write: (message) => output.write(`${message}\n`),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAdministratorOperatorCommand(createProcessTerminal()).then((result) => { process.exitCode = result.exitCode; });
}
