import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
const mockPassport = { state: { phase: 'ready', status: { availableActions: ['ACTIVATE'], lifecycleState: 'APPROVED' } },
  activate: jest.fn() };
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ passportId: '22222222-2222-4222-8222-222222222222' }),
  useRouter: () => mockRouter,
}));
jest.mock('./passport-state', () => ({
  usePassportState: () => mockPassport,
  PASSPORT_NOTICE_MESSAGES: { 'invalid-state': 'Acci\u00f3n inv\u00e1lida' },
}));

import ActivatePassportRoute from '../../app/(authenticated)/passports/[passportId]/activate';
import { CustodyConfirmationState } from '../administrator/custody/custody-confirmation-state';
import { buildAnalystSummaryFixture, buildLinkedPassportSummaryFixture } from '../administrator/testing/feature-007-fixtures';

const passportId = '22222222-2222-4222-8222-222222222222';

describe('Feature 009 explicit activation to manual custody', () => {
  beforeEach(() => jest.clearAllMocks());

  it('navigates only after successful ACTIVE activation for the same passport', async () => {
    let finish!: (result: unknown) => void;
    mockPassport.activate.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const screen = await render(<ActivatePassportRoute />);
    await fireEvent.press(screen.getByRole('button', { name: 'Activar' }));
    expect(mockPassport.activate).toHaveBeenCalledWith(passportId);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await act(async () => finish({ kind: 'success', value: { passportId, lifecycleState: 'ACTIVE' } }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(`/admin/custody/${passportId}`));
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: 'invalid-state' }, 'failed activation'],
    [{ kind: 'success', value: { passportId, lifecycleState: 'APPROVED' } }, 'non-active result'],
    [{ kind: 'success', value: { passportId: '33333333-3333-4333-8333-333333333333', lifecycleState: 'ACTIVE' } }, 'another passport'],
  ] as const)('does not navigate on %s (%s)', async (result) => {
    mockPassport.activate.mockResolvedValue(result);
    const screen = await render(<ActivatePassportRoute />);
    await fireEvent.press(screen.getByRole('button', { name: 'Activar' }));
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('keeps activation committed and custody unchanged when assignment selection is abandoned', async () => {
    mockPassport.activate.mockResolvedValue({ kind: 'success', value: { passportId, lifecycleState: 'ACTIVE' } });
    const screen = await render(<ActivatePassportRoute />);
    await fireEvent.press(screen.getByRole('button', { name: 'Activar' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(`/admin/custody/${passportId}`));
    const assign = jest.fn().mockResolvedValue('applied');
    const custody = new CustodyConfirmationState(assign);
    const existing = buildLinkedPassportSummaryFixture();
    custody.beginAssignment({ ...existing, passportId });
    custody.selectAnalyst(buildAnalystSummaryFixture());
    custody.cancel();
    expect(custody.snapshot).toEqual({ stage: 'idle' });
    expect(assign).not.toHaveBeenCalled();
    expect(mockPassport.activate).toHaveBeenCalledTimes(1);
  });
});
