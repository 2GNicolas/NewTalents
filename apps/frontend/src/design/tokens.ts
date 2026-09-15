export const authTokens = {
  colors: {
    canvas: '#07110D',
    canvasDeep: '#030806',
    surface: '#0B1A13',
    surfaceElevated: '#10251B',
    surfacePressed: '#173426',
    border: '#31513E',
    borderSubtle: '#1E382A',
    primary: '#C7FF2E',
    primaryPressed: '#AEE629',
    textPrimary: '#F4F6EB',
    textSecondary: '#A8B7A8',
    textMuted: '#789080',
    danger: '#FF826D',
    warning: '#FFD36B',
    success: '#C7FF2E',
    focusRing: '#C7FF2E',
    overlay: 'rgba(0, 0, 0, 0.68)',
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
  },
  typography: {
    display: { fontSize: 26, lineHeight: 31, fontWeight: '800' as const, letterSpacing: -0.45 },
    title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.2 },
    body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
    label: { fontSize: 14, lineHeight: 20, fontWeight: '700' as const, letterSpacing: 0.1 },
    caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  },
  sizing: {
    minInteractiveSize: 44,
    buttonHeight: 52,
    fieldHeight: 52,
    loadingBlockHeight: 120,
    contentMaxWidth: 370,
    desktopPanelMinWidth: 420,
  },
  breakpoints: {
    mobile: 0,
    tablet: 720,
    desktop: 1024,
  },
  focus: {
    webOutlineColor: '#C7FF2E',
    webOutlineWidth: 3,
    borderWidth: 2,
  },
  shadow: {
    restrained: {
      shadowColor: '#000000',
      shadowOpacity: 0.24,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
  },
} as const;

export function createAuthMotionTokens(reducedMotion: boolean) {
  return reducedMotion
    ? { durationMs: 0, decorativeOpacity: 1 }
    : { durationMs: 180, decorativeOpacity: 0.82 };
}

export type AuthButtonVariant = 'primary' | 'secondary' | 'destructive';
export type AuthAlertVariant = 'info' | 'success' | 'warning' | 'danger';
