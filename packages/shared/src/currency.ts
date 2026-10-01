/** The Ghana cedi sign. All fares and payments are in cedis. */
export const CEDI = '₵';

export const DISPLAY_CURRENCIES = ['GHS', 'USD', 'EUR', 'GBP', 'NGN'] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export const CURRENCY_LABELS: Record<DisplayCurrency, string> = {
  GHS: 'Ghana cedi (₵)',
  USD: 'US dollar ($)',
  EUR: 'Euro (€)',
  GBP: 'British pound (£)',
  NGN: 'Nigerian naira (₦)',
};

const SYMBOLS: Record<DisplayCurrency, string> = { GHS: CEDI, USD: '$', EUR: '€', GBP: '£', NGN: '₦' };

/**
 * Indicative value of ₵1 in each currency, used only to show visitors an approximate price. The payment is always
 * charged in cedis. These are fixed rough figures with no live feed: replace them with a live rate source (or the
 * union's published rate) before launch.
 */
export const INDICATIVE_RATES: Record<Exclude<DisplayCurrency, 'GHS'>, number> = { USD: 0.09, EUR: 0.08, GBP: 0.07, NGN: 135 };
export const RATES_NOTE = 'Approximate. You are charged in cedis.';

export function formatCedis(amount: number): string {
  return `${CEDI}${amount.toFixed(2)}`;
}

/** "≈ $0.18" for a cedi amount, or null when the display currency is the cedi itself. */
export function formatApprox(amountGhs: number, currency: DisplayCurrency): string | null {
  if (currency === 'GHS') return null;
  const value = amountGhs * INDICATIVE_RATES[currency];
  const digits = currency === 'NGN' ? 0 : 2;
  return `≈ ${SYMBOLS[currency]}${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
