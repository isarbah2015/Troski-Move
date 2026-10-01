import { useColorScheme } from 'react-native';
import { colors as dark, lightColors as light, radii, type ThemeScheme } from '@trotrolink/shared';

/** The scheme the app is showing: the user's choice (applied via Appearance) or the device's. Defaults to dark. */
export function useScheme(): ThemeScheme {
  return useColorScheme() === 'light' ? 'light' : 'dark';
}

/**
 * Semantic colour names over the locked tokens in @trotrolink/shared (design.ts), for the current theme.
 * Pass `force` for screens that are always one theme (the camera screen is always dark).
 */
export function useColors(force?: ThemeScheme) {
  const system = useScheme();
  const scheme = force ?? system;
  const p = scheme === 'light' ? light : dark;
  return {
    scheme,
    background: p.background,
    foreground: p.textPrimary,
    card: p.surface,
    cardElevated: p.surfaceElevated,
    cardForeground: p.textPrimary,
    primary: p.accentEmerald,
    // Dark text on the bright dark-theme emerald; white text on the deeper light-theme emerald.
    primaryForeground: scheme === 'light' ? '#FFFFFF' : '#04130D',
    /** Action gradient (top-left to bottom-right) for primary buttons. */
    gradient: (scheme === 'light' ? ['#12A576', '#066B4C'] : ['#4CE8B4', '#16B887']) as readonly [string, string],
    /** Navy hero card gradient: the same deep navy in both themes. */
    hero: ['#0F2A4D', '#0A1A33'] as readonly [string, string],
    /** Frosted-glass fill for the tab bar and floating chips (use over a BlurView). */
    glass: scheme === 'light' ? 'rgba(255,255,255,0.72)' : 'rgba(14,21,36,0.72)',
    /** Soft card shadow: visible in light, near-invisible in dark where tone and hairlines carry the depth. */
    elevation: (scheme === 'light'
      ? { shadowColor: '#0F172A', shadowOpacity: 0.07, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 3 }
      : { shadowColor: '#000000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 0 }) as {
      shadowColor: string; shadowOpacity: number; shadowRadius: number; shadowOffset: { width: number; height: number }; elevation: number;
    },
    /** Glow under primary buttons. */
    glow: { shadowColor: scheme === 'light' ? '#047857' : '#2BD99F', shadowOpacity: scheme === 'light' ? 0.28 : 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
    secondary: p.primaryNavy,
    secondaryForeground: '#FFFFFF',
    muted: p.border,
    mutedForeground: p.textSecondary,
    accent: p.highlightGold,
    destructive: p.error,
    destructiveForeground: '#FFFFFF',
    border: p.border,
    radius: radii.card,
    radiusModal: radii.modal,
    radiusPill: radii.pill,
  };
}
