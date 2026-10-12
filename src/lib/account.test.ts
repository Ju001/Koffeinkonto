import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRICE_CENTS,
  emptyAccount,
  exportAccount,
  parseAccount,
} from './account';

const valid = {
  v: 1,
  priceCents: 25,
  updatedAt: 1000,
  events: [
    { id: 'a', ts: 1, type: 'topup', cents: 500 },
    { id: 'b', ts: 2, type: 'coffee', cents: 25 },
  ],
};

describe('emptyAccount', () => {
  it('has the default price and no events', () => {
    const a = emptyAccount(5);
    expect(a).toEqual({ v: 1, priceCents: DEFAULT_PRICE_CENTS, events: [], updatedAt: 5 });
  });
});

describe('parseAccount', () => {
  it('accepts a valid account', () => {
    expect(parseAccount(JSON.stringify(valid))).toEqual(valid);
  });
  it('round-trips through exportAccount', () => {
    expect(parseAccount(exportAccount(valid as never))).toEqual(valid);
  });
  it('rejects null and empty input', () => {
    expect(parseAccount(null)).toBeNull();
    expect(parseAccount('')).toBeNull();
  });
  it('rejects invalid JSON', () => {
    expect(parseAccount('{not json')).toBeNull();
  });
  it('rejects non-objects', () => {
    expect(parseAccount('[]')).toBeNull();
    expect(parseAccount('42')).toBeNull();
    expect(parseAccount('null')).toBeNull();
  });
  it('rejects an unknown version', () => {
    expect(parseAccount(JSON.stringify({ ...valid, v: 2 }))).toBeNull();
  });
  it('rejects a zero, negative, or fractional price', () => {
    for (const priceCents of [0, -5, 0.5, Number.NaN]) {
      expect(parseAccount(JSON.stringify({ ...valid, priceCents }))).toBeNull();
    }
  });
  it('rejects malformed events', () => {
    const bad = [
      { id: 'a', ts: 1, type: 'refund', cents: 5 },
      { id: 'a', ts: 1, type: 'topup', cents: 0 },
      { id: 'a', ts: 1, type: 'topup', cents: 1.5 },
      { id: 1, ts: 1, type: 'topup', cents: 5 },
      { id: 'a', type: 'topup', cents: 5 },
    ];
    for (const e of bad) {
      expect(parseAccount(JSON.stringify({ ...valid, events: [e] }))).toBeNull();
    }
  });
  it('drops unknown extra properties', () => {
    const parsed = parseAccount(JSON.stringify({ ...valid, evil: true }));
    expect(parsed).toEqual(valid);
    expect(parsed).not.toHaveProperty('evil');
  });
});
