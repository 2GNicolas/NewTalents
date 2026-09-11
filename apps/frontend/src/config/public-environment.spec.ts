import { parsePublicEnvironment } from './public-environment';

describe('parsePublicEnvironment', () => {
  it.each(['http://localhost:3000', 'https://api.example.test'])('accepts %s', (value) => {
    expect(parsePublicEnvironment({ EXPO_PUBLIC_API_BASE_URL: value })).toEqual({ ok: true, apiBaseUrl: value });
  });

  it.each([undefined, '', '__REQUIRED__', 'CHANGE_ME', 'ftp://example.test', 'localhost:3000', 'https://user:pass@example.test'])('rejects an invalid API URL', (value) => {
    expect(parsePublicEnvironment({ EXPO_PUBLIC_API_BASE_URL: value })).toEqual({ ok: false, reason: 'public-configuration-invalid' });
  });

  it.each(['EXPO_PUBLIC_TOKEN', 'EXPO_PUBLIC_PASSWORD', 'EXPO_PUBLIC_CLIENT_SECRET', 'EXPO_PUBLIC_API_KEY'])('rejects secret-looking public variable %s', (name) => {
    expect(parsePublicEnvironment({ EXPO_PUBLIC_API_BASE_URL: 'http://localhost:3000', [name]: 'sensitive' })).toEqual({ ok: false, reason: 'public-configuration-invalid' });
  });
});
