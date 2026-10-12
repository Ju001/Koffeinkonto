const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "3 Oct" within the current year, "3 Oct 2025" otherwise, "never" when unset. */
export function formatBackupDate(ts: number | null, now: number): string {
  if (ts === null) return 'never';
  const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear();
  return (sameYear ? dayMonth : dayMonthYear).format(ts);
}
