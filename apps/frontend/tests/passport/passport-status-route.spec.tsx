import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useLocalSearchParams: jest.fn(() => ({ passportId: '44444444-4444-4444-8444-444444444444' })),
}));

jest.mock('../../src/passport/passport-state', () => ({
  usePassportState: () => ({
    state: {
      phase: 'ready',
      list: null,
      context: 'PARTICULAR',
      academyId: null,
      collectionActions: null,
      activePassportId: '44444444-4444-4444-8444-444444444444',
      status: {
        passportId: '44444444-4444-4444-8444-444444444444',
        displayName: 'Jugador',
        lifecycleState: 'APPROVED',
        origin: 'PARTICULAR',
        academyOriginName: null,
        availableActions: ['EDIT'],
        version: 1,
        correctionReason: null,
        ageSensitiveMutationAvailability: 'AVAILABLE',
      },
      presentation: null,
      history: null,
      internalHistory: null,
      editableDraft: null,
    },
    selectPassport: jest.fn(),
    loadHistory: jest.fn(),
    loadInternalHistory: jest.fn(),
    loadEditableDraft: jest.fn(),
    clearActivePassport: jest.fn(),
    createDraft: jest.fn(),
    editDraft: jest.fn(),
    submit: jest.fn(),
    returnForCorrection: jest.fn(),
    resolveDuplicate: jest.fn(),
    approve: jest.fn(),
    activate: jest.fn(),
    hasCapability: jest.fn(() => false),
    hasCollectionAction: jest.fn(() => false),
  }),
}));

jest.mock('../../src/passport/status-view', () => ({
  StatusView: () => null,
}));

import PassportStatusRoute from '../../app/(authenticated)/passports/[passportId]/index';

describe('Feature 005 technical status route', () => {
  it('shows a safe restricted state instead of technical status when view_history is not authorized', async () => {
    const screen = await render(<PassportStatusRoute />);

    expect(screen.getByText('No tienes autorización para ver el estado e historial.')).toBeTruthy();
    expect(screen.queryByText('Estado del pasaporte')).toBeNull();
  });
});
