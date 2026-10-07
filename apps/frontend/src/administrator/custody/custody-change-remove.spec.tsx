import { fireEvent, render } from '@testing-library/react-native';

import { buildAnalystSummaryFixture, buildLinkedPassportSummaryFixture } from '../testing/feature-007-fixtures';
import { CustodyChangeRemove } from './custody-change-remove';
import { CustodyConfirmationState } from './custody-confirmation-state';
import { PassportCustodyState } from './passport-custody-state';

const analystA = buildAnalystSummaryFixture({ identityId: '70000000-0000-4000-8000-000000000001', displayLabel: 'Analista A', activeCustodyCount: 3 });
const analystB = buildAnalystSummaryFixture({ identityId: '70000000-0000-4000-8000-000000000002', displayLabel: 'Analista B', activeCustodyCount: 2 });
const assigned = buildLinkedPassportSummaryFixture({
  custody: { state: 'ASSIGNED', version: 1, analyst: analystA, assignedAt: '2026-10-01T09:00:00.000Z' },
  capabilities: ['CHANGE', 'REMOVE'],
});

describe('custody change/remove frontend', () => {
  it('offers equivalent Cambiar Analista and Retirar custodia actions from current authority', async () => {
    const onChange = jest.fn();
    const onRemove = jest.fn();
    const screen = await render(<CustodyChangeRemove passport={assigned} analysts={[analystA, analystB]} onChange={onChange} onRemove={onRemove} />);
    expect(screen.getByText('Custodia actual: Analista A')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar Analista de Jugador Sintético' }));
    expect(screen.queryByRole('button', { name: /Seleccionar Analista A/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Seleccionar Analista B como nueva custodia' }));
    expect(onChange).toHaveBeenCalledWith(assigned, analystB);
    expect(onRemove).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Retirar custodia de Jugador Sintético' }));
    expect(onRemove).toHaveBeenCalledWith(assigned);
  });

  it('uses the shared confirmation state and requires a safe reason for change and removal', async () => {
    const execute = jest.fn().mockResolvedValue('applied');
    const confirmation = new CustodyConfirmationState(execute, () => '90000000-0000-4000-8000-000000000001');
    confirmation.beginChange(assigned);
    confirmation.selectAnalyst(analystB);
    await expect(confirmation.confirm()).resolves.toBe('invalid');
    expect(execute).not.toHaveBeenCalled();
    confirmation.setReason('Cambio operativo confirmado');
    await expect(confirmation.confirm()).resolves.toBe('applied');
    expect(execute).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'CHANGE', analystIdentityId: analystB.identityId, expectedVersion: 1 }));

    confirmation.beginRemoval(assigned);
    confirmation.setReason('Retiro operativo confirmado');
    await expect(confirmation.confirm()).resolves.toBe('applied');
    expect(execute).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'REMOVE', expectedVersion: 1 }));
    expect(execute.mock.calls.at(-1)?.[0]).not.toHaveProperty('analystIdentityId');
  });

  it('disables invalid actions and cancellation has no command effect', async () => {
    const onChange = jest.fn();
    const onRemove = jest.fn();
    const invalid = { ...assigned, capabilities: [] as const };
    const screen = await render(<CustodyChangeRemove passport={invalid} analysts={[analystA, analystB]} onChange={onChange} onRemove={onRemove} />);
    expect(screen.getByRole('button', { name: 'Cambiar Analista de Jugador Sintético' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Retirar custodia de Jugador Sintético' })).toBeDisabled();

    const execute = jest.fn();
    const confirmation = new CustodyConfirmationState(execute);
    confirmation.beginRemoval(assigned);
    confirmation.cancel();
    expect(confirmation.snapshot).toEqual({ stage: 'idle' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('refreshes current authority and workloads only after success while safe failure preserves prior state', async () => {
    let changeResult: 'success' | 'failure' = 'failure';
    const listCustodyPassports = jest.fn(async (filters: { assignment: string }) => ({ kind: 'success' as const, value: { items: filters.assignment === 'ASSIGNED' ? [assigned] : [] } }));
    const listCustodyAnalysts = jest.fn(async () => ({ kind: 'success' as const, value: { items: [analystA, analystB] } }));
    const state = new PassportCustodyState({
      listCustodyPassports, listCustodyAnalysts,
      assignPassportCustody: jest.fn(),
      changePassportCustody: jest.fn(async () => changeResult === 'failure' ? { kind: 'unavailable' as const } : { kind: 'success' as const, value: { data: { passportId: assigned.passportId, eventId: 'event-2', custody: { state: 'ASSIGNED' as const, version: 2, analystIdentityId: analystB.identityId, assignedAt: '2026-10-01T10:00:00.000Z' } }, idempotent: false } }),
      removePassportCustody: jest.fn(),
    });
    await state.load();
    const before = state.snapshot;
    await expect(state.applyConfirmedTransition({ action: 'CHANGE', passportId: assigned.passportId, analystIdentityId: analystB.identityId, expectedVersion: 1, idempotencyKey: '90000000-0000-4000-8000-000000000001', reason: 'Cambio seguro' })).resolves.toBe('failed');
    expect(state.snapshot).toBe(before);
    expect(listCustodyPassports).toHaveBeenCalledTimes(2);

    changeResult = 'success';
    await expect(state.applyConfirmedTransition({ action: 'CHANGE', passportId: assigned.passportId, analystIdentityId: analystB.identityId, expectedVersion: 1, idempotencyKey: '90000000-0000-4000-8000-000000000002', reason: 'Cambio seguro' })).resolves.toBe('applied');
    expect(listCustodyPassports).toHaveBeenCalledTimes(4);
    expect(listCustodyAnalysts).toHaveBeenCalledTimes(2);
  });
});
