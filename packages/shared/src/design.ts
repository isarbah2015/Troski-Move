/**
 * Dark palette: an ink-navy base with layered surfaces (background < surface < surfaceElevated) and hairline borders,
 * so depth comes from tone instead of heavy outlines. Emerald is the action colour, gold the highlight.
 */
export const colors = {
  background: '#060A13',
  surface: '#0E1524',
  surfaceElevated: '#162036',
  primaryNavy: '#0B1F3A',
  accentEmerald: '#2BD99F',
  highlightGold: '#E7B85A',
  textPrimary: '#F6F8FC',
  textSecondary: '#8A97AE',
  border: 'rgba(255,255,255,0.09)',
  error: '#F2555A',
} as const;

export const radii = { card: 20, modal: 32, pill: 999 } as const;
export const font = 'Plus Jakarta Sans';
export const fontWeights = [400, 500, 600, 700, 800] as const;

/**
 * Light palette. Same roles as `colors`, tuned for white surfaces: pure-white cards float over a cool grey
 * background on soft shadows, and the emerald/gold accents are darkened so they stay readable (WCAG AA).
 */
export const lightColors = {
  background: '#F3F5F9',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  primaryNavy: '#0B1F3A',
  accentEmerald: '#07805A',
  highlightGold: '#9A6700',
  textPrimary: '#0A1020',
  textSecondary: '#566178',
  border: 'rgba(15,23,42,0.09)',
  error: '#D93036',
} as const;

export type ThemeScheme = 'light' | 'dark';
export type ThemePreference = 'system' | 'light' | 'dark';
