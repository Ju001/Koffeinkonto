# Koffeinkonto UI and Balance Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the foundation shell with the real single-screen app: balance, steaming cup, top-up, price, undo toast, backup date.

**Architecture:** Pure operations (`ops.ts`, `parseEuro`) are unit-tested without a DOM. A factory-built Svelte 5 rune store (`store.svelte.ts`) applies ops and persists through the existing `saveAccount`. Small presentational components (`Cup`, `Sheet`, `Toast`) render it; `App.svelte` wires them together.

**Tech Stack:** Svelte 5 (runes), TypeScript 6, Vite, Vitest, Playwright, native `<dialog>`.

**Spec:** `docs/superpowers/specs/2026-10-12-koffeinkonto-ui-design.md`

## Global Constraints

- Money is integer cents; euro formatting stays `formatEuro` (`de-DE`). UI copy is English, sentence case.
- No login, accounts, backend or network calls. State stays browser-local.
- Do not change the `Account` v1 schema or `persistence.ts`/`kv.ts` behaviour. Last backup lives under its own key `koffeinkonto.lastBackup`.
- Palette tokens: light bg `#F3EDE2`, text `#2B1D17`, muted `#6f6a5c`, green `#1F5E4B`, crema `#E9B872`, saucer `#fff` / shadow `#d8d0c0`; dark bg `#1E1712`.
- Cup has no face, no blush, no gloss or gradients. Steam: three always-visible wisps, continuous sway, never fading; still under `prefers-reduced-motion`.
- Targets at least 44 px, cup at least 160 px, visible focus rings, text contrast at least 4.5:1 in both themes.
- Commits: no co-author or attribution trailers.
- Use latest stable packages; add no new dependencies.

## Review Focus

- Two rapid taps on the cup: both coffees are recorded, in order, none lost (tested in Task 3 and Task 6).
- Amount input such as `1,5`, `1.50`, ` 7 `, `1,505`, `-5`, `0`, `1e3`, `` (empty), `99999999`: parsed or rejected per spec, never `NaN`, never beyond the cap of 1 000 000 cents (Task 1).
- Price raised above the balance, or balance negative: coffees left shows 0, never negative (Task 2).
- Another tab writes a newer account while a toast is showing: toast is cleared so Undo cannot remove the other tab's event (Task 3).
- Both storage backends fail on an action: in-memory state rolls back and the error is shown, no phantom coffee (Task 3 and Task 6).

---

### Task 1: Euro input parsing

**Files:**
- Modify: `src/lib/money.ts`
- Test: `src/lib/money.test.ts`

**Interfaces:**
- Produces: `export const MAX_AMOUNT_CENTS = 1_000_000`; `export function parseEuro(input: string): number | null` (integer cents, or `null` when invalid).

- [ ] **Step 1: Write failing tests** in `money.test.ts`, `describe('parseEuro')`: `'7,50'→750`, `'7.50'→750`, `'7'→700`, `' 5 '→500`, `'0,05'→5`, `'1,5'→150`. Rejected (`null`): `''`, `'0'`, `'0,00'`, `'-5'`, `'1,505'`, `'abc'`, `'1e3'`, `'1,2,3'`, `'10000,01'`. Accepted boundary: `'10000'→1000000`.
- [ ] **Step 2: Run** `npx vitest run src/lib/money.test.ts`. Expected: FAIL, `parseEuro` is not exported.
- [ ] **Step 3: Implement `parseEuro` and `MAX_AMOUNT_CENTS`** in `money.ts`: trim, match `^\d+([.,]\d{1,2})?$`, convert without floating-point arithmetic, reject 0 and anything above the cap.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: parse euro input`.

### Task 2: Pure balance operations

**Files:**
- Create: `src/lib/ops.ts`
- Test: `src/lib/ops.test.ts`

**Interfaces:**
- Consumes: `Account`, `AccountEvent` from `account.ts`.
- Produces:
  - `topUp(a: Account, cents: number, id: string, ts: number): Account`
  - `drink(a: Account, id: string, ts: number): Account` (event `cents = a.priceCents`)
  - `undo(a: Account): { account: Account; removed: AccountEvent | null }`
  - `setPrice(a: Account, cents: number): Account`
  - `balanceCents(a: Account): number`
  - `coffeesLeft(a: Account): number`
  All return new objects; none mutate input or touch `updatedAt` (saving stamps it). Ids and timestamps are passed in to keep the functions pure.

- [ ] **Step 1: Write failing tests** covering: balance after topup 500 and two coffees at 20 is 460; `coffeesLeft` is 23; negative balance (-20) gives `balanceCents` -20 and `coffeesLeft` 0; `setPrice(a, 25)` leaves earlier coffee events at their original cents and changes `balanceCents` by nothing; price above balance gives `coffeesLeft` 0; `undo` returns the removed last event and the shorter list; `undo` on an empty account returns `removed: null` and an equal account; inputs are not mutated (`Object.freeze` the account and its events array).
- [ ] **Step 2: Run** `npx vitest run src/lib/ops.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the six functions in `ops.ts`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add pure balance operations`.

### Task 3: Reactive store

**Files:**
- Create: `src/lib/store.svelte.ts`
- Test: `src/lib/store.svelte.test.ts`

**Interfaces:**
- Consumes: `loadAccount`, `saveAccount`, `STORAGE_KEY`, `KV`, `LoadStatus` from `persistence.ts`; `parseAccount` from `account.ts`; Task 2 ops.
- Produces:
  ```ts
  export interface StoreDeps { primary: KV; mirror: KV; meta: KV;
    now?: () => number; newId?: () => string }
  export type Toast = { kind: 'coffee' | 'topup' | 'price'; cents: number; undoable: boolean };
  export interface Store {
    readonly account: Account | null; readonly status: LoadStatus | null;
    readonly saveError: boolean; readonly toast: Toast | null;
    readonly lastBackupAt: number | null;
    readonly balanceCents: number; readonly coffeesLeft: number;
    readonly disabled: boolean;               // true while loading or status === 'corrupt'
    init(): Promise<void>;
    drink(): Promise<void>; topUp(cents: number): Promise<void>;
    setPrice(cents: number): Promise<void>; undo(): Promise<void>;
    dismissToast(): void; markBackedUp(): Promise<void>;
    applyExternal(raw: string | null): void;  // from another tab's storage event
    importAccount(a: Account): Promise<boolean>;
  }
  export const LAST_BACKUP_KEY = 'koffeinkonto.lastBackup';
  export function createStore(deps: StoreDeps): Store;
  ```
  The `meta` KV stores `LAST_BACKUP_KEY` as a decimal timestamp string; in the app it is `localStorageKV`.

- [ ] **Step 1: Write failing tests** using in-memory and always-throwing KVs (copy the `memKV` and `throwingKV` helpers' shape from `persistence.test.ts`): `init` loads and sets `status`; `drink` appends a coffee at the current price and persists to both KVs; two un-awaited `drink()` calls then `await`ing both yield two coffee events; `topUp(1000)` toast is `{kind:'topup',cents:1000,undoable:true}`; `setPrice(25)` toast has `undoable:false` and no event is added; `undo()` restores the previous account and clears the toast; when both KVs throw, `drink()` leaves `account` unchanged and sets `saveError` true, and a later successful action clears it; `applyExternal` with a valid newer account replaces `account` and clears `toast`, with an older or invalid one it changes nothing; `markBackedUp` writes `LAST_BACKUP_KEY` and sets `lastBackupAt`; `init` reads an existing `LAST_BACKUP_KEY`; `disabled` is true for `status === 'corrupt'`, and `drink()` then does nothing.
- [ ] **Step 2: Run** `npx vitest run src/lib/store.svelte.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `createStore`** with `$state` fields. Serialise actions through a single promise chain. Defaults: `now = Date.now`, `newId = crypto.randomUUID` with a `Date.now()`-plus-counter fallback. On each action: compute the next account with the pure op, `saveAccount`, then commit the stamped result; on rejection keep the old account and set `saveError`.
- [ ] **Step 4: Run** the same command. Expected: PASS. Run `npm run check` and expect 0 errors (confirms runes compile in `.svelte.ts`).
- [ ] **Step 5: Commit** `feat: add reactive account store`.

### Task 4: Design tokens, cup and sheet components

**Files:**
- Modify: `src/app.css`, `index.html` (theme colour to `#F3EDE2`), `vite.config.ts` (manifest `theme_color` and `background_color` to `#F3EDE2`)
- Create: `src/components/Cup.svelte`, `src/components/Sheet.svelte`

**Interfaces:**
- Produces:
  - `Cup.svelte`: props `{ onclick: () => void; disabled?: boolean }`. A single `<button aria-label="Drink a coffee">` at least 160 px containing the flat SVG cup and the three animated steam wisps; press squash via `:active`; calls `navigator.vibrate?.(15)` on click.
  - `Sheet.svelte`: props `{ open: boolean; title: string; onclose: () => void; children }`. Wraps a native `<dialog>`; `showModal()` when `open` becomes true, closes on Esc, backdrop click and `close` event, restores focus to the opener, labelled by `title`. Bottom-aligned on mobile.
- `app.css` defines the CSS variables from Global Constraints for light and dark (`prefers-color-scheme`), a `:focus-visible` ring, and a `prefers-reduced-motion` rule that disables animation and transition globally.

- [ ] **Step 1: Implement** the tokens in `app.css` (replace `--bg`/`--fg`; keep `body` layout but left-align content inside a column of max 420 px).
- [ ] **Step 2: Implement `Cup.svelte`** from the approved mockup (flat cup, saucer, crema, steam: wisps `animation: wave` at 2.1 s, 2.4 s, 2.9 s with negative offsets, `alternate`, never touching opacity).
- [ ] **Step 3: Implement `Sheet.svelte`.**
- [ ] **Step 4: Verify** `npm run check` and `npm run lint` report 0 errors. Components are exercised end to end in Task 6.
- [ ] **Step 5: Commit** `feat: add design tokens, cup and sheet components`.

### Task 5: Screen, sheets, toast, footer

**Files:**
- Create: `src/components/Toast.svelte`, `src/components/TopUpSheet.svelte`, `src/components/PriceSheet.svelte`, `src/lib/dates.ts`
- Modify: `src/App.svelte` (rewrite)
- Test: `src/lib/dates.test.ts`

**Interfaces:**
- Consumes: `createStore`, `Store`, `localStorageKV`, `indexedDbKV`, `requestPersistentStorage`, `parseEuro`, `formatEuro`, `MAX_AMOUNT_CENTS`, `exportAccount`, `parseAccount`.
- Produces:
  - `formatBackupDate(ts: number | null, now: number): string`: `null` gives `'never'`; same year gives `'3 Oct'` (`en-GB`, day and short month); another year appends the year (`'3 Oct 2025'`).
  - `Toast.svelte`: props `{ toast: Toast | null; onundo: () => void; ondismiss: () => void }`; text `Coffee recorded`, `Added 10,00 €`, `Price set to 0,25 €`; Undo button only when `undoable`; auto-dismiss after 5 s; `aria-live="polite"`; occupies a reserved slot (no layout shift).
  - `TopUpSheet.svelte`: props `{ open, priceCents, onclose, onconfirm: (cents: number) => void }`; chips 5, 10, 20 € fill the field; field has `inputmode="decimal"`; live preview `= N coffees at <price>` via `floor(cents / priceCents)`; confirm labelled `Add <amount>` and disabled with an inline reason when `parseEuro` is `null`.
  - `PriceSheet.svelte`: props `{ open, priceCents, onclose, onconfirm: (cents: number) => void }`; hint `Only affects future coffees`.

Layout and copy follow spec section "Screen". Keep test ids: `coffees-left`, `balance`, `price`, `last-backup`, `restore-notice`, `corrupt-notice`, `storage-status`, `import-error`, `save-error`, `import-input`. Buttons: `Drink a coffee`, `Top up`, price button (name `Price per coffee: 0,20 €`), `Export backup`, `Import backup`. A negative balance renders `Owed 0,40 €` in `balance`. Cup, `Top up` and price are disabled when `store.disabled`. `window` `storage` listener on `STORAGE_KEY` calls `store.applyExternal(event.newValue)`. Export calls `store.markBackedUp()` after the download and revokes the blob URL in a `setTimeout` (10 s).

- [ ] **Step 1: Write failing `dates.test.ts`**: `null` gives `never`; a timestamp in the same year gives `3 Oct`; one a year earlier includes the year.
- [ ] **Step 2: Run** `npx vitest run src/lib/dates.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `dates.ts`.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Implement** `Toast`, `TopUpSheet`, `PriceSheet` and the `App.svelte` rewrite.
- [ ] **Step 6: Verify** `npm run check`, `npm run lint`, `npm test` all pass; run `npm run dev` and confirm in a browser that the screen renders, steam moves, and a tap changes the count.
- [ ] **Step 7: Commit** `feat: build the coffee account screen`.

### Task 6: End-to-end tests

**Files:**
- Modify: `e2e/persistence.spec.ts` (the old `account-summary` is gone: restored account with `priceCents: 25` and one 500-cent topup now shows `coffees-left` 20 and `price` containing `0,25`; the corrupt-storage test asserts `coffees-left` count 0 and the cup disabled instead)
- Create: `e2e/app.spec.ts`

**Interfaces:**
- Consumes: test ids and button names from Task 5.

- [ ] **Step 1: Update** `persistence.spec.ts` as described and run `npm run test:e2e -- e2e/persistence.spec.ts`. Expected: PASS.
- [ ] **Step 2: Write `app.spec.ts` tests** (each starts from empty storage and top-up helper): top up 5 € via preset `5 €` then `coffees-left` is `25`; custom `7,50` then `balance` shows `7,50 €`; drinking decrements `coffees-left` by 1 and persists across reload; toast Undo restores the count; two fast clicks on the cup record two coffees; balance at zero then one tap shows `Owed 0,20 €` and `coffees-left` `0`; top-up with `-5` and `1,505` keeps the confirm button disabled; changing price to `0,25` then drinking reduces balance by 25 cents while earlier coffees are unchanged (compare `balance` before and after); `last-backup` reads `never`, then today's date after clicking `Export backup` (use `page.waitForEvent('download')`); with `reducedMotion: 'reduce'` the steam path has computed `animation-name` `none`; the top-up dialog closes on Esc and returns focus to `Top up`.
- [ ] **Step 3: Run** `npm run test:e2e`. Expected: all specs pass, including the unchanged `smoke.spec.ts`.
- [ ] **Step 4: Commit** `test: cover the coffee account flows`.

### Task 7: Icon, docs and wrap-up

**Files:**
- Modify: `public/icon.svg` (flat cup, no face, palette tokens), `docs/TODO.md`, `README.md` if it lists features
- Regenerate: `public/icons/*.png` via `npm run icons`

- [ ] **Step 1: Redraw `icon.svg`** with the flat cup on the `#F3EDE2` background with safe-zone padding for the maskable icon; run `npm run icons`.
- [ ] **Step 2: Update `docs/TODO.md`**: tick the §2 product items and the stale-second-tab item in §3; remove the "Product" bullet about the shell in the note under §2.
- [ ] **Step 3: Verify** `npm run lint && npm run check && npm test && npm run build && npm run test:e2e` all pass.
- [ ] **Step 4: Commit** `chore: redraw icons and update TODO`.
