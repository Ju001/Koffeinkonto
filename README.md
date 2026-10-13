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

## Deploy (GitHub Actions)

Pushes to `main` run lint, type check, unit tests, build, and e2e tests. On
success the `deploy` job (`appleboy/ssh-action`) connects to the server,
fast-forwards the checkout to the exact commit that passed CI, rebuilds the
container with `docker compose`, and installs the Caddy site snippet from
`caddy/koffeinkonto.caddy` (validated first, rolled back on failure).

### Server prerequisites

1. Docker with the compose plugin.
2. A checkout of this repo (use a read-only deploy key) at the path configured
   as `DEPLOY_PATH`.
3. The `shared` Docker network, with your Caddy container (named `caddy`)
   attached to it.
4. SSH access for a user that can run `docker`.
5. Caddy importing site snippets from the directory configured as
   `CADDY_SITES_DIR`. `caddy/koffeinkonto.caddy` is a template; the deploy job
   replaces `koffeinkonto.example.com` with `KOFFEINKONTO_DOMAIN`.

### Repository secrets

Deployment specifics are kept out of the repository. The job refuses to run if
any of these is missing.

| Secret | Content |
|---|---|
| `VPS_HOST` | Server hostname or IP |
| `VPS_PORT` | SSH port |
| `VPS_USER` | SSH user on the server |
| `VPS_SSH_KEY` | Private key (dedicated deploy key) |
| `VPS_HOST_FINGERPRINT` | Server host key fingerprint, the `SHA256:...` part of `ssh-keygen -lf <(ssh-keyscan -t ed25519 -p <port> <host>)`. Without it the action would not verify the host |
| `DEPLOY_PATH` | Absolute path of the repo checkout on the server |
| `CADDY_SITES_DIR` | Directory where the Caddy site snippet is written |
| `KOFFEINKONTO_DOMAIN` | Public hostname served by Caddy |

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
