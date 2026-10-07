import { buildAnalystSummaryFixture, buildLinkedPassportSummaryFixture } from '../testing/feature-007-fixtures';
import { CustodyConfirmationState } from './custody-confirmation-state';

const passport = buildLinkedPassportSummaryFixture();
const analyst = buildAnalystSummaryFixture();
const currentKey = (state: CustodyConfirmationState): string => {
  if (!('idempotencyKey' in state.snapshot)) throw new Error('Expected a confirmation intention');
  return state.snapshot.idempotencyKey;
};

function keys() {
  let sequence = 0;
  return () => `90000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
}

describe('CustodyConfirmationState', () => {
  it('keeps the assignment destination ephemeral and sends nothing before confirm', async () => {
    const execute = jest.fn().mockResolvedValue('applied');
    const state = new CustodyConfirmationState(execute, keys());

    state.beginAssignment(passport);
    expect(state.snapshot).toMatchObject({ stage: 'selecting', passport, action: 'ASSIGN' });
    state.selectAnalyst(analyst);
    expect(state.snapshot).toMatchObject({ stage: 'confirmation', passport, analyst, action: 'ASSIGN' });
    expect(state.snapshot).not.toHaveProperty('reason');
    expect(execute).not.toHaveBeenCalled();
    await expect(state.confirm()).resolves.toBe('applied');
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ action: 'ASSIGN' }));
    expect(execute.mock.calls[0]?.[0]).not.toHaveProperty('reason');
  });

  it('uses a new UUID when the assignment passport or destination changes', () => {
    const state = new CustodyConfirmationState(jest.fn(), keys());
    state.beginAssignment(passport);
    state.selectAnalyst(analyst);
    const destinationKey = currentKey(state);
    state.beginAssignment({ ...passport, passportId: '70000000-0000-4000-8000-000000000099' });
    state.selectAnalyst(analyst);

    expect(currentKey(state)).not.toBe(destinationKey);
  });

  it('retains the same UUID and intention for a recoverable connectivity retry', async () => {
    const execute = jest.fn().mockResolvedValueOnce('failed').mockResolvedValueOnce('applied');
    const state = new CustodyConfirmationState(execute, keys());
    state.beginAssignment(passport);
    state.selectAnalyst(analyst);
    const idempotencyKey = currentKey(state);

    await expect(state.confirm()).resolves.toBe('failed');
    expect(state.snapshot).toMatchObject({ stage: 'recoverable-error', idempotencyKey });
    await expect(state.retry()).resolves.toBe('applied');
    expect(execute.mock.calls[0]?.[0]).toEqual(execute.mock.calls[1]?.[0]);
    expect(state.snapshot).toMatchObject({ stage: 'applied', idempotencyKey });
  });

  it('clears every unconfirmed value on cancel or unmount disposal', () => {
    const execute = jest.fn();
    const state = new CustodyConfirmationState(execute, keys());
    state.beginAssignment(passport);
    state.selectAnalyst(analyst);
    state.cancel();
    expect(state.snapshot).toEqual({ stage: 'idle' });
    expect(execute).not.toHaveBeenCalled();

    state.beginAssignment(passport);
    state.selectAnalyst(analyst);
    state.dispose();
    expect(state.snapshot).toEqual({ stage: 'idle' });
    expect(execute).not.toHaveBeenCalled();
  });
});
