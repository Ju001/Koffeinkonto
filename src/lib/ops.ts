import type { Account, AccountEvent } from './account';

// Pure account operations. Ids and timestamps are passed in; `updatedAt` is
// stamped by saveAccount, so none of these touch it.

export function topUp(a: Account, cents: number, id: string, ts: number): Account {
  return { ...a, events: [...a.events, { id, ts, type: 'topup', cents }] };
}

/** Records one coffee at the current price; later price changes never alter it. */
export function drink(a: Account, id: string, ts: number): Account {
  return { ...a, events: [...a.events, { id, ts, type: 'coffee', cents: a.priceCents }] };
}

export function undo(a: Account): { account: Account; removed: AccountEvent | null } {
  const removed = a.events.at(-1) ?? null;
  if (!removed) return { account: a, removed: null };
  return { account: { ...a, events: a.events.slice(0, -1) }, removed };
}

export function setPrice(a: Account, cents: number): Account {
  return { ...a, priceCents: cents };
}

/** Top-ups minus coffees; may be negative. */
export function balanceCents(a: Account): number {
  return a.events.reduce((sum, e) => sum + (e.type === 'topup' ? e.cents : -e.cents), 0);
}

export function coffeesLeft(a: Account): number {
  return Math.max(0, Math.floor(balanceCents(a) / a.priceCents));
}
