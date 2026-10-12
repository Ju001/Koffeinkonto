# Koffeinkonto – Foundation Design

Date: 2026-10-12
Status: Approved; updated 2026-10-12 with persistence resilience and version policy

## Purpose

Koffeinkonto is a small, stylish, installable web app (PWA) that acts as a
prepaid "coffee account" for office coffee. A user sets a price per coffee and
tops up money in advance (e.g. 5 € at 0.20 € = 25 coffees). Tapping a cute
coffee-cup button deducts one coffee.

This spec covers the **foundation**: tech stack, devcontainer, container image,
and build/deploy pipeline, plus a minimal app shell so the pipeline builds and
tests something real. The coffee UI and balance logic are a separate follow-up
spec → plan cycle.

## Requirements and constraints

- Runs in the browser; installable as a PWA; works offline.
- User state persisted in `localStorage` only. No online database, no backend
  logic, no accounts.
- Multiple devices, but exactly one user per device. Each device holds its own
  independent account; there is no synchronisation between devices.
- Dockerized. Deployed via GitHub Actions to a vserver over SSH.
- Simple and stylish.

## Tech stack

Latest stable releases of all packages, images, and actions (verified
2026-10-12). Exception: TypeScript stays on 6.x until `typescript-eslint` and
`svelte-check` support 7. Node 24 (current LTS).

| Concern | Choice |
|---|---|
| UI framework | Svelte + TypeScript |
| Build tool | Vite |
| PWA | `vite-plugin-pwa` (manifest, icons, precaching service worker) |
| Unit tests | Vitest |
| E2E smoke test | Playwright |
| Lint / typecheck | ESLint, `svelte-check` |
| Runtime image | `nginx:alpine` serving static files |
| Orchestration | Docker Compose |
| CI/CD | GitHub Actions |

## App (target architecture, implemented in follow-up spec)

- Single page: large cup button, balance display (coffees left and € left),
  top-up sheet, price setting. Mobile-first, warm palette, light/dark, tap
  animation and haptics where supported.
- Fully static; no network access needed after first load.

### Data model

One versioned, validated JSON document:

```
{ v: 1, priceCents: 20, updatedAt: <ms>, events: [{ id, ts, type: "topup" | "coffee", cents }] }
```

- Money is integer cents. Balance is the sum of events; coffees left is
  `floor(balance / priceCents)`.
- Undo removes the last event.
- Logic lives in pure modules (no DOM) so it is unit-testable.

### Persistence resilience

Browsers can evict or lose a single storage area (storage pressure, "clear
site data", Safari's tab eviction, private mode, a corrupted value). All
mitigations stay on the device; nothing is sent over the network.

1. **Dual write.** Every save writes the document to `localStorage` (primary)
   and IndexedDB (mirror). Each save stamps `updatedAt`.
2. **Self-healing load.** On start, both copies are read and validated. The
   newest valid copy wins and the other is rewritten. If only the mirror
   survives, the app restores the primary and tells the user.
3. **Never silently overwrite.** If stored data exists but nothing validates,
   the app reports it and offers backup import; it does not replace the raw
   data on its own.
4. **Degrade, don't fail.** If one backend is unavailable (e.g. IndexedDB in
   private mode), the app works with the other. A save fails only if both fail.
5. **Persistent storage request.** `navigator.storage.persist()` is requested;
   if refused, the UI says the browser may clear the data and recommends a
   backup.
6. **Export/import.** JSON backup download and strict-validated import; also
   the device-migration path. A "last backup" reminder comes with the full UI
   in the follow-up spec.
7. **iOS.** Installed (home-screen) PWAs are exempt from Safari's seven-day
   eviction of unused site data; the README recommends installing.

Known limit: clearing all site data (both backends) still erases the account.
Concurrent edits from two tabs are last-write-wins.

### Storage caveats

Storage is per browser and origin. An installed PWA and the same site in a
normal browser tab may not share data (platform-dependent, notably iOS).

## Container

- Multi-stage `Dockerfile`: `node:lts-alpine` runs `npm ci && npm run build`;
  final stage is `nginx:alpine` serving `dist/`.
- nginx config: SPA fallback to `index.html`; `no-cache` on `index.html` and
  `sw.js`; long immutable cache on hashed assets.
- `docker-compose.yml`: single service `koffeinkonto`, no published ports,
  attached to an external Docker network `web`.

### TLS / reverse proxy

The app does not handle TLS. The vserver's Caddy (to be extracted into its own
stack, separate from the other project) joins the external `web` network and
proxies to the container:

```
koffeinkonto.example.com {
    reverse_proxy koffeinkonto:80
}
```

HTTPS is required for PWA installability and service workers.

## Devcontainer

- Node LTS base image, Docker CLI feature, Playwright browsers installed.
- Port 5173 forwarded; `npm ci` on create.
- Editor extensions: ESLint, Svelte.

## CI/CD (GitHub Actions)

**On pull request and push:** lint, typecheck, Vitest, build, Playwright smoke
test.

**On `main` after green:** SSH to the vserver (private key and pinned host key
from secrets), `git pull` in the deploy directory, run
`docker compose up -d --build`, prune old images. Build happens on the server.

Required repository secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY`,
`SSH_KNOWN_HOSTS`, optional `DEPLOY_PATH`.

Server prerequisites: Docker with compose plugin, a git checkout of the repo
(read-only deploy key), and the external `web` network
(`docker network create web`).

## Scope of the foundation iteration

In scope:
- Repo scaffold (Svelte + Vite + TS + PWA plugin) with a minimal shell page
- Persistence layer (dual-write, self-healing load, export/import) and tests
- Vitest and Playwright set up with one trivial test each
- `Dockerfile`, nginx config, `docker-compose.yml`
- `.devcontainer/`
- GitHub Actions workflows (CI and deploy)
- README covering local dev, server prerequisites, and secrets

Out of scope (follow-up spec):
- Cup button UI, balance operations (top-up, drink, undo), price setting,
  backup reminder, final icons and styling

## Out of scope entirely

Cross-device sync, accounts, multi-currency, any backend.

## Risks

- Build-on-server consumes vserver CPU/RAM during deploys; acceptable for a
  small static app, revisit if the server is constrained.
- Clearing all site data loses the balance; mitigated by the mirror,
  persistent storage request, and export/import.
