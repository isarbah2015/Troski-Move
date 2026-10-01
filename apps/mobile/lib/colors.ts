export { colors, lightColors, radii } from '@trotrolink/shared';

/*
 * Fixed colours that must NOT change with the theme:
 * - scrims sit over any content and are always dark;
 * - QR codes must stay black on white to scan;
 * - the camera screen and the navy "hero" cards are dark in both themes.
 */
export const SCRIM = 'rgba(11,18,32,0.6)';
export const SCRIM_STRONG = 'rgba(11,18,32,0.8)';
export const CAMERA_DIM = 'rgba(11,18,32,0.45)';
export const QR_FG = '#0B1220';
export const QR_BG = '#FFFFFF';
export const WHITE = '#FFFFFF';
export const SILVER = '#94A3B8';
export const NAVY = '#0B1F3A';
export const HERO_GRADIENT = ['#0B1F3A', '#121A2B'] as const;
export const GOLD = '#D4A437';
export const BRONZE = '#D4A43799';
export const EMERALD = '#10B981';
export const ERROR = '#EF4444';
