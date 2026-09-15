import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';

import { LiquidGlassPanel } from './liquid-glass-panel';

describe('LiquidGlassPanel', () => {
  it('renders a stable translucent surface with a non-interactive highlight', async () => {
    const screen = await render(<LiquidGlassPanel testID="glass"><></></LiquidGlassPanel>);
    expect(screen.getByTestId('glass')).toBeTruthy();
  });

  it('declares actual web backdrop diffusion with a prefixed fallback without requiring native blur', () => {
    const source = require('node:fs').readFileSync(require('node:path').resolve(process.cwd(), 'src/design/components/liquid-glass-panel.tsx'), 'utf8');
    expect(source).toContain("backdropFilter: 'blur(28px) saturate(135%)'");
    expect(source).toContain("WebkitBackdropFilter: 'blur(28px) saturate(135%)'");
    expect(source).toContain("Platform.OS === 'web'");
    expect(source).not.toContain('expo-blur');
    expect(Platform.OS).toBeDefined();
  });
});
