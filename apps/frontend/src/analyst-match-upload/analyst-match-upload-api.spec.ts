import { createAnalystMatchUploadApi } from './analyst-match-upload-api';

const matchId = '22222222-2222-4222-8222-222222222222';
const key = '33333333-3333-4333-8333-333333333333';
const input = { expectedVersion: 1, participation: 'DID_NOT_PARTICIPATE' as const,
  totalMinutesPlayed: 0, youtubeUrl: 'https://youtu.be/Feature011TestVideo', events: [] };

describe('Feature 011 final-write API boundary', () => {
  it('posts once only when invoked, with full final payload and stable intention', async () => {
    const fetcher = jest.fn(async () => ({ ok: true, status: 200,
      json: async () => ({ matchId, outcome: 'APPLIED' }) })) as unknown as typeof fetch;
    const api = createAnalystMatchUploadApi({ getAccessToken: () => 'synthetic-token',
      apiBaseUrl: 'http://localhost:3000', fetcher });
    expect(fetcher).not.toHaveBeenCalled();
    expect(await api.confirm?.(matchId, input, key)).toEqual({ kind: 'success', value: { matchId, outcome: 'APPLIED' } });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(`/matches/${matchId}/capture/confirm`),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input), cache: 'no-store',
        headers: expect.objectContaining({ 'Idempotency-Key': key, Authorization: 'Bearer synthetic-token' }) }));
  });

  it('does not echo protected data from validation or conflict responses', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce({ ok: false, status: 422 })
      .mockResolvedValueOnce({ ok: false, status: 409 });
    const api = createAnalystMatchUploadApi({ getAccessToken: () => 'synthetic-token',
      apiBaseUrl: 'http://localhost:3000', fetcher });
    expect(await api.confirm?.(matchId, input, key)).toEqual({ kind: 'validation' });
    expect(await api.confirm?.(matchId, input, key)).toEqual({ kind: 'conflict' });
  });
});
