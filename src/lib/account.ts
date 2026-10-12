export type EventType = 'topup' | 'coffee';

export interface AccountEvent {
  id: string;
  ts: number;
  type: EventType;
  cents: number;
}

export interface Account {
  v: 1;
  priceCents: number;
  events: AccountEvent[];
  updatedAt: number;
}

export const DEFAULT_PRICE_CENTS = 20;

export function emptyAccount(now: number = Date.now()): Account {
  return { v: 1, priceCents: DEFAULT_PRICE_CENTS, events: [], updatedAt: now };
}

const isPositiveInt = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n > 0;

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

function parseEvent(x: unknown): AccountEvent | null {
  if (!isRecord(x)) return null;
  const { id, ts, type, cents } = x;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return null;
  if (type !== 'topup' && type !== 'coffee') return null;
  if (!isPositiveInt(cents)) return null;
  return { id, ts, type, cents };
}

/** Strictly validate serialized account data. Returns a normalised copy or null. */
export function parseAccount(raw: string | null): Account | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.v !== 1) return null;
  const { priceCents, updatedAt, events } = data;
  if (!isPositiveInt(priceCents)) return null;
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) return null;
  if (!Array.isArray(events)) return null;
  const parsed: AccountEvent[] = [];
  for (const e of events) {
    const ev = parseEvent(e);
    if (!ev) return null;
    parsed.push(ev);
  }
  return { v: 1, priceCents, events: parsed, updatedAt };
}

export function exportAccount(account: Account): string {
  return JSON.stringify(account, null, 2);
}
