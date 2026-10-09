import { render } from '@testing-library/react-native';
import type { PassportSummaryResponse } from '../../src/passport/passport-types';
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ context: 'PARTICULAR' }), useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('../../src/authentication/components/session-controls', () => ({ SessionControls: () => null }));
jest.mock('../../src/passport/passport-state', () => { const passport = { state: { phase: 'ready', context: 'PARTICULAR', academyId: null, list: [] as readonly PassportSummaryResponse[], collectionActions: ['CREATE_SELF', 'CREATE_REPRESENTED_MINOR'], activePassportId: null, status: null, editableDraft: null, presentation: null, history: null, internalHistory: null, notice: undefined }, loadList: jest.fn(), hasCollectionAction: jest.fn((action: string) => action === 'CREATE_SELF' || action === 'CREATE_REPRESENTED_MINOR') }; return { __esModule: true, mockPassport: passport, usePassportState: () => passport, PASSPORT_NOTICE_MESSAGES: {} }; });
import PassportEntryRoute from '../../app/(authenticated)/passports/index';
const module = jest.requireMock('../../src/passport/passport-state') as { mockPassport: { state: { list: readonly PassportSummaryResponse[]; collectionActions: readonly string[] }; hasCollectionAction: jest.Mock } };
describe('passport collection actions', () => {
  beforeEach(() => jest.clearAllMocks());
  it('renders only backend-projected particular creation choices', async () => { const screen = await render(<PassportEntryRoute />); expect(screen.getByRole('button', { name: 'Crear mi pasaporte' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Crear para un menor' })).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Crear en academia' })).toBeNull(); });
  it('shows an honest empty state when no passport is accessible', async () => { module.mockPassport.state.collectionActions = []; module.mockPassport.hasCollectionAction.mockReturnValue(false); const screen = await render(<PassportEntryRoute />); expect(screen.getByText('No hay pasaportes accesibles en este contexto.')).toBeTruthy(); });
});
