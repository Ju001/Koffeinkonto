const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

/** Format an integer amount of cents as a euro string, e.g. 20 -> "0,20 €". */
export function formatEuro(cents: number): string {
  return euro.format(cents / 100);
}

/** Largest accepted single amount: 10.000 €. Guards the balance against absurd input. */
export const MAX_AMOUNT_CENTS = 1_000_000;

/**
 * Parse a user-typed euro amount ("7,50", "7.5", "7") into integer cents.
 * Returns null for empty, zero, negative, malformed, or above-cap input.
 */
export function parseEuro(input: string): number | null {
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const euros = Number(m[1]);
  if (!Number.isSafeInteger(euros) || euros > MAX_AMOUNT_CENTS / 100) return null;
  const cents = euros * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return cents > 0 && cents <= MAX_AMOUNT_CENTS ? cents : null;
}

/** Editable form of an amount ("1000,00"): no currency sign or thousands separator, so parseEuro accepts it. */
export function formatEuroInput(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
}
