import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('web credential autofill treatment', () => {
  it('keeps browser-managed password fields on the dark authentication surface', () => {
    const stylesheet = readFileSync(resolve(process.cwd(), 'app/global.css'), 'utf8');
    expect(stylesheet).toContain('input:-webkit-autofill');
    expect(stylesheet).toContain('-webkit-box-shadow: 0 0 0 1000px #1e211f inset !important;');
    expect(stylesheet).toContain('-webkit-text-fill-color: #f4f6eb !important;');
  });
});
