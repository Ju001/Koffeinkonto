const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

/** Format an integer amount of cents as a euro string, e.g. 20 -> "0,20 €". */
export function formatEuro(cents: number): string {
  return euro.format(cents / 100);
}
