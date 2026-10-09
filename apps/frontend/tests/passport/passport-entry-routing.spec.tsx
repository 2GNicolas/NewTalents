import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { PassportSummaryResponse } from '../../src/passport/passport-types';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('../../src/authentication/components/session-controls', () => ({
  SessionControls: () => null,
}));

jest.mock('../../src/passport/passport-state', () => {
  const passport = {
    state: {
      phase: 'ready',
      context: 'PARTICULAR',
      academyId: null,
      list: [] as readonly PassportSummaryResponse[],
      collectionActions: [] as readonly string[],
      activePassportId: null,
      status: null,
      editableDraft: null,
      presentation: null,
      history: null,
      internalHistory: null,
      notice: undefined,
    },
    loadList: jest.fn(),
    hasCollectionAction: jest.fn(() => false),
  };
  return {
    __esModule: true,
    mockPassport: passport,
    usePassportState: () => passport,
    PASSPORT_NOTICE_MESSAGES: {},
  };
});

import { useLocalSearchParams, useRouter } from 'expo-router';
import PassportEntryRoute from '../../app/(authenticated)/passports/index';

const routeParams = useLocalSearchParams as jest.Mock;
const routerMock = useRouter as jest.Mock;
const passportModule = jest.requireMock('../../src/passport/passport-state') as {
  mockPassport: {
    state: {
      phase: string;
      context: 'PARTICULAR' | 'ACADEMY';
      academyId: string | null;
      list: readonly PassportSummaryResponse[];
      collectionActions: readonly string[];
    };
    loadList: jest.Mock;
    hasCollectionAction: jest.Mock;
  };
};

const passportId = '44444444-4444-4444-8444-444444444444';

function passport(overrides: Partial<PassportSummaryResponse> = {}): PassportSummaryResponse {
  return {
    passportId,
    displayName: 'Samuel Ramírez',
    lifecycleState: 'ACTIVE',
    origin: 'PARTICULAR',
    academyOriginName: null,
    availableActions: ['VIEW'],
    ...overrides,
  };
}

function arrange(context: 'PARTICULAR' | 'ACADEMY', passports: readonly PassportSummaryResponse[], academyId: string | null = null) {
  const push = jest.fn();
  const replace = jest.fn();
  routeParams.mockReturnValue(context === 'ACADEMY' ? { context, academyId } : { context });
  routerMock.mockReturnValue({ push, replace });
  passportModule.mockPassport.state.phase = 'ready';
  passportModule.mockPassport.state.context = context;
  passportModule.mockPassport.state.academyId = academyId;
  passportModule.mockPassport.state.list = passports;
  passportModule.mockPassport.state.collectionActions = context === 'ACADEMY'
    ? ['VIEW_ACADEMY_PORTFOLIO']
    : ['VIEW_PARTICULAR_SELECTOR'];
  return { push, replace };
}

describe('corrective contextual passport entry', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens the only particular passport in Resumen without requiring create capability', async () => {
    const navigation = arrange('PARTICULAR', [passport()], null);
    await render(<PassportEntryRoute />);

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(`/passports/${passportId}/sections/resumen`));
    expect(passportModule.mockPassport.loadList).toHaveBeenCalledWith({ context: 'PARTICULAR' });
  });

  it('shows an explicit player selector for several represented players', async () => {
    const navigation = arrange('PARTICULAR', [
      passport(),
      passport({ passportId: '55555555-5555-5555-8555-555555555555', displayName: 'Lucía Ramírez', lifecycleState: 'DRAFT' }),
    ]);
    const screen = await render(<PassportEntryRoute />);

    expect(screen.getByText('Selecciona un jugador')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Abrir pasaporte de Lucía Ramírez' }));
    expect(navigation.push).toHaveBeenCalledWith('/passports/55555555-5555-5555-8555-555555555555/sections/resumen');
  });

  it('always renders the authorized academy portfolio, including one passport', async () => {
    const academyId = '66666666-6666-4666-8666-666666666666';
    const navigation = arrange('ACADEMY', [passport({ origin: 'ACADEMY', academyOriginName: 'Academia Norte' })], academyId);
    const screen = await render(<PassportEntryRoute />);

    expect(screen.getByText('Cartera de Academia Norte')).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(passportModule.mockPassport.loadList).toHaveBeenCalledWith({ context: 'ACADEMY', academyId });
  });

  it('keeps particular and academy requests explicit and separate', async () => {
    arrange('ACADEMY', [], '66666666-6666-4666-8666-666666666666');
    await render(<PassportEntryRoute />);

    expect(passportModule.mockPassport.loadList).toHaveBeenCalledWith({
      context: 'ACADEMY',
      academyId: '66666666-6666-4666-8666-666666666666',
    });
    expect(passportModule.mockPassport.loadList).not.toHaveBeenCalledWith({ context: 'PARTICULAR' });
  });
});
