import { Platform } from 'react-native';

/** Passport-specific tokens: do not change Feature 004 authentication styling. */
export const passportTheme = {
  colors: {
    canvas: '#00120E',
    glass: 'rgba(0, 23, 19, 0.62)',
    glassRaised: 'rgba(10, 57, 43, 0.30)',
    border: 'rgba(128, 221, 181, 0.62)',
    divider: 'rgba(107, 177, 164, 0.26)',
    lime: '#A5FF00',
    white: '#F2F7F5',
    secondary: '#BED0D4',
    muted: '#86A4A7',
  },
  fontFamily: Platform.OS === 'web' ? 'Arial, Helvetica, sans-serif' : undefined,
} as const;

/** At the 853px source viewport the mobile composition is twice the 426.5px layout. */
export function passportScale(width: number): number {
  return width >= 1024 ? 1 : Math.max(0.88, Math.min(width / 426.5, 2));
}
