# Koffeinkonto – remaining work

Status as of 2026-10-12: the app (UI, persistence, Espresso dark theme) is on
`main`, pushed to GitHub and live. Known issues are listed in `README.md`.
Specs and plans live in `docs/superpowers/`.

## 1. Go live (done 2026-10-12)

- [x] Create the GitHub repo, add the remote, push `main`.
- [x] Server: `docker network create shared` (skip if it already exists).
- [x] Server: split Caddy into its own stack attached to `shared`; site block
      `koffeinkonto.<domain> { reverse_proxy koffeinkonto:80 }`.
- [x] Server: clone the repo with a read-only deploy key to
      `/opt/prod/Koffeinkonto`; SSH on port 2222.
- [x] Repo secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`,
      `VPS_HOST_FINGERPRINT` (host key `SHA256:` fingerprint).
- [x] First push: watch CI and deploy; fix anything the local checks could
      not catch (workflow and devcontainer were only syntax-validated).
- [x] Open the devcontainer once to confirm `npm ci` and
      `npx playwright install --with-deps chromium` succeed.

## 2. Product (next spec → plan cycle, start with brainstorming)

- [x] Cup button UI (cute stylised cup, tap animation, haptics)
- [x] Balance display: coffees left and € left (`floor(balance / price)`)
- [x] Top-up (add money) and price-per-coffee setting
- [x] Drink a coffee (deduct one), undo last event
- [x] "Last backup" reminder and export/import polish
- [x] Final icons, palette, light/dark styling

Implemented per `docs/superpowers/specs/2026-10-12-koffeinkonto-ui-design.md`:
logic in `src/lib/ops.ts` and `src/lib/store.svelte.ts`, UI in
`src/App.svelte` and `src/components/`.

## 3. Deferred review findings (minors)

- [x] `src/lib/kv.ts`: reopen the IndexedDB connection after failure or
      `onclose`/`onversionchange` (cached `dbPromise` is never reset, so the
      mirror can go silently stale in a long session).
- [x] `src/App.svelte` `downloadBackup`: revoke the blob URL in a
      `setTimeout`; synchronous revoke may yield no file on iOS Safari.
- [x] Stale second tab can export outdated data: listen for `storage`
      events or reload account before export.
- [x] Import: reject files above a few MB before `file.text()`.

## 3b. Deferred minors from the UI review

- [x] Balance line: resolved by the approved mockup layout
      (`coffees left · 4,80 €`, price on its button).
- [x] Undo can remove a different event than the toast names if pressed while
      a newer action is still saving: capture the event id in the toast and
      undo only if it is still last.
- [x] Cup: add `touch-action: manipulation` (possible double-tap zoom).
- [x] Toast: pause the 5 s auto-dismiss on focus/hover (WCAG 2.2.1).
- [x] `applyExternal` leaves a stale `saveError` banner.
- [x] Last-backup date is not synced across tabs (`koffeinkonto.lastBackup`
      is not handled by the storage listener).
- [x] Price prefill is invalid for prices of 1.000 € or more (`formatEuro`
      thousands separator is rejected by `parseEuro`).
- [x] Add a dark `theme-color` meta variant.
- [x] E2E light/dark smoke screenshots (spec Testing section).

## 3c. Deferred minors from the second review

- [ ] `store.undo(eventId)`: on a mismatch, only clear the toast if it still
      names `eventId` (today a newer toast and its Undo can vanish in a race).
- [ ] `kv.ts`: if an open fires `onblocked` and later succeeds, close the
      orphaned connection in `onsuccess`.

## 4. Maintenance and decisions

- [ ] Re-check TypeScript 7: pinned to `^6` because `typescript-eslint`
      (`<6.1`) and `svelte-check` (`^5 || ^6`) do not support it. Run
      `npm view typescript-eslint peerDependencies` and
      `npm view svelte-check peerDependencies`.
- [ ] Node 26 becomes LTS in late October 2026; then bump `.nvmrc`,
      `Dockerfile`, and `.devcontainer/devcontainer.json` from 24.
- [ ] CI builds twice (Playwright `webServer` rebuilds); optional cleanup.
- [ ] Re-verify "latest packages" when touching dependencies (project policy).

## Project conventions

- Never add co-author or attribution trailers to commits or docs.
- Use the latest stable packages, images, and actions; document exceptions.
- State is browser-local only: `localStorage` primary, IndexedDB mirror, no
  backend. One user per device, no sync.
- Workflow: brainstorming → written spec → plan → inline (native) execution
  with TDD and one whole-branch review.
