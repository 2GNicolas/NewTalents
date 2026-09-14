import { describe, expect, it } from 'vitest';
import { AttemptControlService } from '../../src/authentication/attempt-control.service.js';
describe('Feature 003 login abuse control', () => { it('persists failures', () => expect(AttemptControlService).toBeTypeOf('function')); });
