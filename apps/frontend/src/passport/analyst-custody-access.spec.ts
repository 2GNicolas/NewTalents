import { createPassportApi, type PassportApi } from './passport-api';
import { PassportStateMachine } from './passport-state';

const passportId = '22222222-2222-4222-8222-222222222222';
const response = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: jest.fn().mockResolvedValue(body) }) as unknown as Response;

describe('Analyst custody passport access', () => {
  it('loads the backend-projected custody collection without reading role text', async () => {
    const fetcher = jest.fn().mockResolvedValue(response(200, { data: [{ passportId, displayLabel: 'Perfil operativo', lifecycleState: 'ACTIVE', academyLabel: 'Academia Norte' }], pagination: { hasMore: false } }));
    const api = createPassportApi({ apiBaseUrl: 'https://api.example.test/' }, fetcher);
    await expect(api.listAnalystPassports({}, 'token')).resolves.toEqual({ kind: 'success', value: { items: [{ passportId, displayLabel: 'Perfil operativo', lifecycleState: 'ACTIVE', academyLabel: 'Academia Norte' }], pagination: { hasMore: false } } });
    expect(fetcher.mock.calls[0][0]).toBe('https://api.example.test/analyst/passports?limit=20');
  });

  it('clears a selected passport and refreshes custody after direct access is revoked', async () => {
    const api = {
      listAnalystPassports: jest.fn().mockResolvedValue({ kind: 'success', value: { items: [], pagination: { hasMore: false } } }),
      status: jest.fn().mockResolvedValue({ kind: 'not-found-safe' }),
      presentation: jest.fn().mockResolvedValue({ kind: 'not-found-safe' }),
    } as unknown as PassportApi;
    const machine = new PassportStateMachine({ api, getAccessToken: () => 'token' });
    await machine.loadAnalystPassports();
    await machine.selectPassport(passportId);
    expect(machine.state.activePassportId).toBeNull();
    expect(api.listAnalystPassports).toHaveBeenCalledWith({}, 'token');
  });
});
