# Koffeinkonto – UI and Balance Operations Design

Date: 2026-10-12
Status: Draft for review
Builds on: `2026-10-12-koffeinkonto-foundation-design.md`

## Purpose

Turn the foundation shell into the real product: a single screen where the
user sees how many coffees are left, taps a cup to drink one, tops up money,
and sets the price. This spec covers the app logic and UI. The persistence
layer, data model, build and deploy pipeline are unchanged.

## Non-goals

- No login, accounts, or user identity of any kind.
- No backend, no network access, no cross-device sync.
- One user per device; each device holds its own independent account.
- No history list, no editing of arbitrary events (undo removes the last one).
- No multi-currency, no localisation beyond English copy with `de-DE` euro
  formatting.

## Decisions

| Topic | Decision |
|---|---|
| Visual direction | Flat "porcelain": green enamel cup, honey crema, white saucer, warm porcelain background. No face, no blush, no gloss or gradients. |
| Steam | Three wisps, always visible, each swaying and stretching continuously at its own pace. No fading. Still under `prefers-reduced-motion`. |
| Top-up | Bottom sheet with presets (5 €, 10 €, 20 €) plus custom amount. |
| Empty balance | A tap always records the coffee; balance may go negative. |
| Undo | Toast after every action; undo removes the last event only. |
| Backup reminder | Always-visible "Last backup: <date>" line (or "Never"). No thresholds, no nagging. |

## Logic

All money is integer cents. All operations are pure functions
(`Account → Account`), unit-tested without a DOM.

`src/lib/ops.ts`:

- `topUp(a, cents)`: append a `topup` event (`id`, `ts`, `cents`).
- `drink(a)`: append a `coffee` event of `a.priceCents`. Because the cost is
  stored on the event, later price changes never alter past coffees.
- `undo(a)`: remove the last event. Returns `{ account, removed }` so the
  toast can name what was undone. No events: returns the account unchanged
  and `removed: null`.
- `setPrice(a, cents)`: change `priceCents` for future coffees only.
- `balanceCents(a)`: sum of `topup` minus sum of `coffee`; may be negative.
- `coffeesLeft(a)`: `max(0, floor(balance / priceCents))`.

`src/lib/money.ts` gains `parseEuro(input): number | null`: accepts `7,50`,
`7.50`, and `7`; trims whitespace; rejects empty, zero, negative, more than two
decimals, and non-numeric input. Returns cents. Used for both top-up and price.

Event ids come from `crypto.randomUUID()` with a timestamp-plus-counter
fallback. Timestamps use `Date.now()`.

## State

`src/lib/store.svelte.ts` (Svelte 5 runes) owns reactive `account`, `status`,
`saveError`, and `lastUndo`.

- Each action applies the pure op, then calls the existing `saveAccount`
  (dual write). On success the reactive account is replaced by the stamped
  result. If both backends reject the write, the previous account is kept in
  memory, `saveError` is set, and the UI says the change was not saved; it
  never pretends to have saved.
- Actions are serialised so quick successive taps cannot interleave saves.
- A `storage` event listener (key `koffeinkonto.account`) reloads the account
  from the other tab's write, so a stale tab cannot export or overwrite newer
  data. This closes the "stale second tab" item in `docs/TODO.md`.
- **Last backup** is a timestamp under its own key, `koffeinkonto.lastBackup`,
  in `localStorage`. It is deliberately outside `Account` so the exported v1
  schema is untouched. It is set after a successful export.

## Screen

Single screen, no routing, mobile-first, content column centred up to about
420 px on larger viewports.

1. Header: "Koffeinkonto" (muted) and a settings button for price and backup.
2. Balance: large serif number of coffees left; below it
   `4,80 € · 0,20 € per coffee`. A negative balance shows "Owed 0,40 €" and
   the big number reads 0.
3. Cup: the steaming cup as one large `<button>` (at least 160 px, accessible
   name "Drink a coffee"). Press feedback is a short squash;
   `navigator.vibrate(15)` where supported (iOS ignores it silently).
4. Actions: "Top up" (primary) and the current price (secondary, opens price
   setting).
5. Footer: "Last backup: 3 Oct" or "Last backup: never"; Export and Import as
   text buttons. Existing status notices (restored, corrupt, storage not
   protected) stay.

### Top-up sheet

Bottom sheet; focus is trapped; Esc and backdrop close it. Preset chips 5 €,
10 €, 20 €. Custom field with `inputmode="decimal"`. Live preview
"= 37 coffees at 0,20 €". Confirm button carries the amount ("Add 10 €") and is
disabled while the input is invalid, with an inline reason.

### Price setting

Same sheet pattern, one field, hint "Only affects future coffees".

### Undo toast

After any action: "Coffee recorded · Undo" or "Added 10 € · Undo", visible 5
seconds, announced via `aria-live="polite"`. A new action replaces it. A
reserved slot prevents layout shift. Undo reverts the last event only.

### Visual system

CSS variables for all tokens. Light is "porcelain"; dark is "espresso"
(chosen 2026-10-12 in the visual companion).

| Token | Light | Dark (espresso) |
|---|---|---|
| background | `#F3EDE2` | `#1E1712` |
| text | `#2B1D17` | `#EFE6D8` |
| muted text | `#6f6a5c` | `#A99C8A` |
| number / accent | `#1F5E4B` | `#E9B872` |
| cup | `#1F5E4B` | `#2E7A60` |
| crema | `#E9B872` | `#E9B872` |
| saucer / shadow | `#fff` / `#d8d0c0` | `#EFE6D8` / `#0E0A07` |
| buttons | `#fff` | `#2A211A` |

Typeface: Bricolage Grotesque (variable, bundled via
`@fontsource-variable/bricolage-grotesque`, precached for offline). Base 17px;
the coffee count is 96px weight 800 with tabular numerals. Layout follows the
approved mockup: light title, `coffees left · 4,80 €` on one line, the hint
"Tap the cup to drink one", and a one-line footer
`Last backup: … · Export · Import`. Dark mode follows `prefers-color-scheme`,
including a dark `theme-color`.

### Accessibility

Visible focus rings, targets of at least 44 px, text contrast at least 4.5:1 in
both themes, `prefers-reduced-motion` disables steam and squash, sheet is a
proper dialog with labelled controls.

### Copy

English, sentence case, plain verbs. The action keeps its name through the
flow ("Top up" button, "Add 10 €" confirm, "Added 10 €" toast).

## Error handling

- Invalid amount: confirm disabled, inline explanation, no state change.
- Save failure (both backends rejected): message "Could not save – browser
  storage is unavailable." In-memory state is rolled back.
- Corrupt stored data: existing behaviour (notice, actions disabled until a
  backup is imported). Cup, top-up and price are disabled in that state.
- Undo with no events: control not shown.

## Testing

- **Vitest (unit)**: every `ops.ts` function including negative balance,
  floor rounding, price change not rewriting history, undo on empty list;
  `parseEuro` valid and invalid table; store behaviour with fake KVs (save
  success, both backends failing rolls back, serialised taps, storage event
  reload); last-backup key set only after export.
- **Playwright (e2e)**: tap cup decrements count; top-up via preset and via
  custom amount; undo from toast; negative balance copy; price change then
  drink; reload persists state; export updates "Last backup"; reduced motion
  has no animation; light and dark smoke screenshots.
- Existing persistence e2e tests keep passing.

## Included deferred fixes

- Stale second tab (see State).
- `downloadBackup`: revoke the blob URL in a `setTimeout` (touched anyway to
  record the backup date).

Not included, remain in `docs/TODO.md` §3: IndexedDB reconnect in `kv.ts` and
the import size limit.

## Out of scope

Sync, accounts, history browsing, notifications, analytics, localisation.

## Risks

- Haptics are unavailable on iOS; the squash animation carries the feedback.
- Storage is per origin; an installed PWA and a browser tab may not share data
  on some platforms (already documented in the foundation spec).
- Last-write-wins across tabs remains; the `storage` listener narrows the
  window but does not eliminate it.
