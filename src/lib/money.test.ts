import { describe, expect, it } from 'vitest';
import { formatEuro, parseEuro } from './money';

// Intl uses a non-breaking space before "€"; normalise for stable assertions.
const f = (cents: number) => formatEuro(cents).replace(/\s/g, ' ');

describe('formatEuro', () => {
  it('formats zero', () => {
    expect(f(0)).toBe('0,00 €');
  });
  it('formats a coffee price', () => {
    expect(f(20)).toBe('0,20 €');
  });
  it('formats a top-up', () => {
    expect(f(500)).toBe('5,00 €');
  });
  it('formats large amounts with thousands separator', () => {
    expect(f(100000)).toBe('1.000,00 €');
  });
  it('formats negative balances', () => {
    expect(f(-20)).toBe('-0,20 €');
  });
});

describe('parseEuro', () => {
  it.each([
    ['7,50', 750],
    ['7.50', 750],
    ['7', 700],
    [' 5 ', 500],
    ['0,05', 5],
    ['1,5', 150],
    ['10000', 1000000],
  ])('parses %j as %i cents', (input, cents) => {
    expect(parseEuro(input)).toBe(cents);
  });

  it.each(['', '0', '0,00', '-5', '1,505', 'abc', '1e3', '1,2,3', '10000,01', '99999999'])(
    'rejects %j',
    (input) => {
      expect(parseEuro(input)).toBeNull();
    },
  );
});
