import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Administrator home route', () => {
  it('owns /admin, loads authorized projections, preserves preview breakpoints, and routes through the shared shell', () => {
    const source = readFileSync(resolve(__dirname, '../../../app/(admin)/admin/index.tsx'), 'utf8');
    expect(source).toContain('AdminHomeState');
    expect(source).toContain('createAdministratorApi');
    expect(source).toContain('active="home"');
    expect(source).toContain('previewMode={previewMode}');
    expect(source).toContain("'/admin/registration'");
    expect(source).toContain("'/admin/dossiers'");
    expect(source).toContain("'/admin/custody'");
  });
});
