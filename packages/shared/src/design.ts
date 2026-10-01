export const colors = {
  background: '#0B1220',
  surface: '#121A2B',
  primaryNavy: '#0B1F3A',
  accentEmerald: '#10B981',
  highlightGold: '#D4A437',
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  border: '#1E293B',
  error: '#EF4444',
} as const;

export const radii = { card: 16, modal: 24, pill: 999 } as const;
export const font = 'Inter';
export const fontWeights = [400, 500, 600, 700] as const;

/**
 * Light palette. Same roles as `colors`, tuned for white surfaces: text and the emerald/gold accents are
 * darkened so they stay readable (WCAG AA) on a light background. Dark remains the default look.
 */
export const lightColors = {
  background: '#F4F7FB',
  surface: '#FFFFFF',
  primaryNavy: '#0B1F3A',
  accentEmerald: '#047857',
  highlightGold: '#A16207',
  textPrimary: '#0B1220',
  textSecondary: '#475569',
  border: '#D5DDE8',
  error: '#DC2626',
} as const;

export type ThemeScheme = 'light' | 'dark';
export type ThemePreference = 'system' | 'light' | 'dark';
