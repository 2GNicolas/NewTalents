export type FrontendPublicConfiguration =
  | Readonly<{ ok: true; apiBaseUrl: string }>
  | Readonly<{ ok: false; reason: 'public-configuration-invalid' }>;

const placeholders = new Set(['__REQUIRED__', 'CHANGE_ME']);
const secretLookingName = /(?:TOKEN|PASSWORD|SECRET|CREDENTIAL|PRIVATE|API_KEY)/i;

export function parsePublicEnvironment(environment: Record<string, string | undefined>): FrontendPublicConfiguration {
  if (Object.keys(environment).some((name) => name.startsWith('EXPO_PUBLIC_') && secretLookingName.test(name))) {
    return Object.freeze({ ok: false, reason: 'public-configuration-invalid' });
  }
  const value = environment.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!value || placeholders.has(value)) return Object.freeze({ ok: false, reason: 'public-configuration-invalid' });
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return Object.freeze({ ok: true, apiBaseUrl: value });
  } catch {
    return Object.freeze({ ok: false, reason: 'public-configuration-invalid' });
  }
}

export function loadPublicEnvironment(): FrontendPublicConfiguration {
  return parsePublicEnvironment({ EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL });
}
