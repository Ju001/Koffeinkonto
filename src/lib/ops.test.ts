import { describe, expect, it } from 'vitest';
import { emptyAccount, type Account } from './account';
import { balanceCents, coffeesLeft, drink, setPrice, topUp, undo } from './ops';

const frozen = (a: Account): Account => {
  a.events.forEach(Object.freeze);
  Object.freeze(a.events);
  return Object.freeze(a);
};

describe('ops', () => {
  it('computes balance and coffees left from events', () => {
    let a = emptyAccount(0);
    a = topUp(a, 500, 'a', 1);
    a = drink(a, 'b', 2);
    a = drink(a, 'c', 3);
    expect(balanceCents(a)).toBe(460);
    expect(coffeesLeft(a)).toBe(23);
  });

  it('records a coffee at the current price', () => {
    const a = drink(emptyAccount(0), 'x', 5);
    expect(a.events).toEqual([{ id: 'x', ts: 5, type: 'coffee', cents: 20 }]);
  });

  it('lets the balance go negative and floors coffees left at zero', () => {
    const a = drink(emptyAccount(0), 'x', 1);
    expect(balanceCents(a)).toBe(-20);
    expect(coffeesLeft(a)).toBe(0);
  });

  it('shows zero coffees when the price exceeds the balance', () => {
    const a = setPrice(topUp(emptyAccount(0), 100, 'a', 1), 150);
    expect(coffeesLeft(a)).toBe(0);
  });

  it('keeps past coffees at their original cost when the price changes', () => {
    let a = topUp(emptyAccount(0), 500, 'a', 1);
    a = drink(a, 'b', 2);
    const before = balanceCents(a);
    a = setPrice(a, 25);
    expect(balanceCents(a)).toBe(before);
    expect(a.priceCents).toBe(25);
    expect(a.events[1]).toMatchObject({ type: 'coffee', cents: 20 });
    expect(drink(a, 'c', 3).events[2]).toMatchObject({ cents: 25 });
  });

  it('undo removes and returns the last event', () => {
    const a = drink(topUp(emptyAccount(0), 500, 'a', 1), 'b', 2);
    const r = undo(a);
    expect(r.removed).toMatchObject({ id: 'b', type: 'coffee' });
    expect(r.account.events.map((e) => e.id)).toEqual(['a']);
  });

  it('undo on an empty account removes nothing', () => {
    const a = emptyAccount(0);
    const r = undo(a);
    expect(r.removed).toBeNull();
    expect(r.account).toEqual(a);
  });

  it('never mutates its input', () => {
    const a = frozen(topUp(emptyAccount(0), 500, 'a', 1));
    expect(() => {
      drink(a, 'b', 2);
      topUp(a, 100, 'c', 3);
      undo(a);
      setPrice(a, 30);
    }).not.toThrow();
  });
});
