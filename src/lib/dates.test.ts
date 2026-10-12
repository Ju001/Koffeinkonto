import { describe, expect, it } from 'vitest';
import { formatBackupDate } from './dates';

const now = new Date(2026, 9, 12, 12).getTime();

describe('formatBackupDate', () => {
  it('says never when there is no backup', () => {
    expect(formatBackupDate(null, now)).toBe('never');
  });
  it('omits the year within the current year', () => {
    expect(formatBackupDate(new Date(2026, 9, 3, 8).getTime(), now)).toBe('3 Oct');
  });
  it('includes the year for older backups', () => {
    expect(formatBackupDate(new Date(2025, 9, 3, 8).getTime(), now)).toBe('3 Oct 2025');
  });
});
