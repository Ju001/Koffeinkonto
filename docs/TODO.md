# Koffeinkonto – remaining work

Status as of 2026-10-12: foundation (stack, devcontainer, Docker, CI/CD,
persistence layer, shell) is merged to `main`. Nothing is pushed yet and no
remote exists. Specs and plans live in `docs/superpowers/`.

## 1. Go live (needs your infrastructure)

- [ ] Create the GitHub repo, add the remote, push `main`.
- [ ] Server: `docker network create web`.
- [ ] Server: split Caddy into its own stack attached to `web`; site block
      `koffeinkonto.<domain> { reverse_proxy koffeinkonto:80 }`.
- [ ] Server: clone the repo with a read-only deploy key to
      `/opt/prod/Koffeinkonto`; SSH on port 2222.
- [ ] Repo secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`,
      `VPS_HOST_FINGERPRINT` (host key `SHA256:` fingerprint).
- [ ] First push: watch CI and deploy; fix anything the local checks could
      not catch (workflow and devcontainer were only syntax-validated).
- [ ] Open the devcontainer once to confirm `npm ci` and
      `npx playwright install --with-deps chromium` succeed.

## 2. Product (next spec → plan cycle, start with brainstorming)

- [ ] Cup button UI (cute stylised cup, tap animation, haptics)
- [ ] Balance display: coffees left and € left (`floor(balance / price)`)
- [ ] Top-up (add money) and price-per-coffee setting
- [ ] Drink a coffee (deduct one), undo last event
- [ ] "Last backup" reminder and export/import polish
- [ ] Final icons, palette, light/dark styling

Data model and persistence API already exist: `src/lib/account.ts`,
`src/lib/persistence.ts`, `src/lib/kv.ts`. The shell in `src/App.svelte` only
shows status and export/import.

## 3. Deferred review findings (minors)

- [ ] `src/lib/kv.ts`: reopen the IndexedDB connection after failure or
      `onclose`/`onversionchange` (cached `dbPromise` is never reset, so the
      mirror can go silently stale in a long session).
- [ ] `src/App.svelte` `downloadBackup`: revoke the blob URL in a
      `setTimeout`; synchronous revoke may yield no file on iOS Safari.
- [ ] Stale second tab can export outdated data: listen for `storage`
      events or reload account before export.
- [ ] Import: reject files above a few MB before `file.text()`.

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
