import { colors, radii } from '@/lib/colors';

/**
 * Semantic names over the locked tokens in @trotrolink/shared (design.ts).
 * Dark is the only palette defined so far; light mode needs tokens added there first.
 */
export function useColors() {
  return {
    background: colors.background,
    foreground: colors.textPrimary,
    card: colors.surface,
    cardForeground: colors.textPrimary,
    primary: colors.accentEmerald,
    primaryForeground: colors.primaryNavy,
    secondary: colors.primaryNavy,
    secondaryForeground: colors.textPrimary,
    muted: colors.border,
    mutedForeground: colors.textSecondary,
    accent: colors.highlightGold,
    destructive: colors.error,
    destructiveForeground: colors.textPrimary,
    border: colors.border,
    radius: radii.card,
    radiusModal: radii.modal,
    radiusPill: radii.pill,
  };
}
