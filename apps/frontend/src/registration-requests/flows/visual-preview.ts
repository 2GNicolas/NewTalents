export function resolveVisualPreview<T extends string>(requested: string | undefined, allowed: readonly T[], fallback: T): T {
  if (process.env.NODE_ENV === 'production') return fallback;
  return requested && allowed.includes(requested as T) ? requested as T : fallback;
}

export function isVisualPreviewActive(requested: string | undefined, _allowed: readonly string[]): boolean {
  return process.env.NODE_ENV !== 'production' && typeof requested === 'string';
}
