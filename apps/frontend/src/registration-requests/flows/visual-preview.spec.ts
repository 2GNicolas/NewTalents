import { isVisualPreviewActive, resolveVisualPreview } from './visual-preview';

describe('resolveVisualPreview', () => {
  const originalEnvironment = process.env.NODE_ENV;

  afterEach(() => { process.env.NODE_ENV = originalEnvironment; });

  it('accepts deterministic visual states outside production', () => {
    process.env.NODE_ENV = 'test';
    expect(resolveVisualPreview('review', ['account', 'review'] as const, 'account')).toBe('review');
  });

  it('ignores preview state selection in production', () => {
    process.env.NODE_ENV = 'production';
    expect(resolveVisualPreview('review', ['account', 'review'] as const, 'account')).toBe('account');
  });

  it('keeps every development URL containing preview read-only, including empty or unknown values', () => {
    process.env.NODE_ENV = 'test';
    expect(isVisualPreviewActive('', ['account', 'review'])).toBe(true);
    expect(isVisualPreviewActive('unknown', ['account', 'review'])).toBe(true);
    expect(isVisualPreviewActive(undefined, ['account', 'review'])).toBe(false);
  });
});
