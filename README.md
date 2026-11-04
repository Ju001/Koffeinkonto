# Koffeinkonto

A tiny installable web app (PWA) for keeping track of a prepaid office coffee
account: top up money, tap the cup when you drink a coffee, and see how many
coffees are left.

**Live: <https://koffeinkonto.wafolcenses.online>**

There is no backend and no account system. All data stays in the browser, and
each device holds its own independent account.

## Features

- **One-tap cup**: tap to drink a coffee; the price is deducted from the balance.
- **Balance at a glance**: coffees left and money left (`floor(balance / price)`).
- **Top-up and price setting**: add money, change the price per coffee.
- **Undo**: take back the last action from the toast.
- **Backups**: export the account as a file, import it to restore or to move it
  to another device; the app reminds you when the last backup is old.
- **Offline and installable**: service worker, web manifest, light and dark theme.
- **Resilient storage**: data is mirrored in two browser backends and restored
  automatically if one of them is wiped or corrupted.

## Tech stack

Svelte 5, TypeScript, Vite, `vite-plugin-pwa` (Workbox), Vitest and Playwright.
Production image: static build served by nginx.

## Develop

Open the repository in the devcontainer, or use Node 24 (see `.nvmrc`):

```bash
npm ci
npm run dev        # http://localhost:5173
```

| Command | Purpose |
|---|---|
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright; builds and previews on :4173) |
| `npm run lint` | ESLint |
| `npm run check` | Type check (`svelte-check`) |
| `npm run build` | Production build into `dist/` |
| `npm run icons` | Regenerate PNG icons from `public/icon.svg` |

### Project layout

| Path | Content |
|---|---|
| `src/App.svelte`, `src/components/` | UI: cup, balance, sheets, toast |
| `src/lib/ops.ts`, `src/lib/store.svelte.ts` | Balance operations and reactive store |
| `src/lib/persistence.ts`, `src/lib/kv.ts` | `localStorage` + IndexedDB storage, backup import/export |
| `src/lib/money.ts`, `src/lib/dates.ts` | Euro parsing/formatting, date helpers |
| `e2e/` | Playwright specs |
| `docs/` | TODO list, specs and implementation plans |

## Run in Docker

```bash
docker network create shared   # once per host, skip if it already exists
docker compose up -d --build
```

The container publishes no ports. Attach a reverse proxy to the same `shared`
network. With Caddy:

```
koffeinkonto.example.com {
    reverse_proxy koffeinkonto:80
}
```

HTTPS is required for PWA installation and the service worker.

## Deploy

Pushes to `main` run lint, type check, unit tests, build and e2e tests. On success
the `promote` job fast-forwards the `release` branch. The VPS deploys from that branch
through a GitHub webhook (receiver and deployer live in the VPS-Proxy repo, see its
`deploy/README.md`); nothing in this repository can reach the server, and it holds no
deploy secrets.

On the VPS the deployer checks out the released commit and runs
`scripts/deploy-remote.sh`, which rebuilds the container with `docker compose` and
installs the Caddy site snippet from `caddy/koffeinkonto.caddy` (validated first,
rolled back on failure). The snippet is a template: the script replaces
`koffeinkonto.example.com` with `KOFFEINKONTO_DOMAIN` from a `.env` file next to the
checkout on the server (see `.env.example`), so the public hostname stays out of the
repository.

### Server prerequisites

1. Docker with the compose plugin and the shared Caddy from VPS-Proxy on the `shared`
   network.
2. A root-owned checkout of this repo registered as project `koffeinkonto` in the
   VPS-Proxy deployer, with a read-only deploy key.
3. `.env` in that checkout with `KOFFEINKONTO_DOMAIN`.
4. A webhook on this repository pointing at the deployer, push events only.

## Data and limitations

- Data never leaves the device. It is written to two browser-local backends
  (`localStorage` and IndexedDB); if one is cleared or corrupted, the other
  restores it automatically.
- The app asks the browser for persistent storage. Browsers may refuse unless
  the app is installed; the UI then recommends regular backups.
- Clearing *all* site data (both backends) still erases the account. Use
  "Export" regularly, and "Import" to restore or to move the account to
  another device.
- Data is per browser and origin. The installed PWA and a normal browser tab
  may not share storage on every platform (notably iOS). On iOS, install the
  app to the home screen; Safari tabs evict unused site data after about
  seven days.
- Concurrent edits from two tabs of the same browser are last-write-wins.
- One user per device; there is no sync between devices.

## License

Apache License 2.0, see [LICENSE](LICENSE).
