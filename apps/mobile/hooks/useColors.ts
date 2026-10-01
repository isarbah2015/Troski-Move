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
    cardForeground: p.textPrimary,
    primary: p.accentEmerald,
    // Dark text on the bright dark-theme emerald; white text on the deeper light-theme emerald.
    primaryForeground: scheme === 'light' ? '#FFFFFF' : p.primaryNavy,
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
