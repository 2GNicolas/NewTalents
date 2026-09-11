import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

describe('Expo Web startup smoke', () => {
  it('exports a usable neutral entry with valid public configuration', () => {
    const root = resolve(__dirname, '../../../..');
    execFileSync(process.execPath, [resolve(root, 'node_modules/expo/bin/cli'), 'export', '--platform', 'web'], {
      cwd: resolve(root, 'apps/frontend'),
      env: { ...process.env, EXPO_PUBLIC_API_BASE_URL: 'http://localhost:3000' },
      stdio: 'pipe',
      timeout: 120_000,
    });
    const index = resolve(root, 'apps/frontend/dist/index.html');
    expect(existsSync(index)).toBe(true);
    expect(readFileSync(index, 'utf8')).toContain('New Talents');
  }, 120_000);
});
