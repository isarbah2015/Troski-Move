/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#1d363a',
    tint: '#f5c94c',

    // Core surfaces
    background: '#f5f0e6',
    foreground: '#1d363a',

    // Cards / elevated surfaces
    card: '#fcfbf7',
    cardForeground: '#1d363a',

    // Primary action color (buttons, links, active states)
    primary: '#1d363a',
    primaryForeground: '#f5f0e6',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#f5c94c',
    secondaryForeground: '#1d363a',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#ebe6db',
    mutedForeground: '#657174',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#acd2c5',
    accentForeground: '#1d363a',

    // Destructive actions (delete, error states)
    destructive: '#ba493d',
    destructiveForeground: '#fcfbf7',

    // Borders and input outlines
    border: '#dfd9ca',
    input: '#dfd9ca',
  },

  dark: {
    text: '#f5f0e6',
    tint: '#f5c94c',
    background: '#1b2d30',
    foreground: '#f5f0e6',
    card: '#23383b',
    cardForeground: '#f5f0e6',
    primary: '#f5c94c',
    primaryForeground: '#1b2d30',
    secondary: '#294346',
    secondaryForeground: '#f5f0e6',
    muted: '#294346',
    mutedForeground: '#b7c1bf',
    accent: '#5f9d8b',
    accentForeground: '#f5f0e6',
    destructive: '#e1796c',
    destructiveForeground: '#1b2d30',
    border: '#3b5558',
    input: '#3b5558',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 14,
};

export default colors;
