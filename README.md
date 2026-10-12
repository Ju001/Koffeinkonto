# Koffeinkonto

A tiny installable web app (PWA) for tracking a prepaid office coffee account.
State lives in the browser's local storage only; there is no backend.
Each device holds its own independent account.

## Develop

Open in the devcontainer, or use Node 24 (`.nvmrc`):

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run test:e2e   # Playwright (builds and previews on :4173)
npm run lint && npm run check
npm run icons      # regenerate PNG icons from public/icon.svg
```

## Run in Docker

```bash
docker network create web   # once per host
docker compose up -d --build
```

The container publishes no ports. Put a reverse proxy on the same `web`
network. With Caddy:

```
koffeinkonto.example.com {
    reverse_proxy koffeinkonto:80
}
```

HTTPS is required for PWA installation and the service worker.

## Deploy (GitHub Actions)

Pushes to `main` run lint, typecheck, unit tests, build, and e2e tests; on
success the `deploy` job SSHes to the server and runs
`git pull --ff-only && docker compose up -d --build`.

### Server prerequisites

1. Docker with the compose plugin.
2. A checkout of this repo (use a read-only deploy key) at `~/koffeinkonto`,
   or set `DEPLOY_PATH`.
3. `docker network create web`, and your Caddy attached to that network.
4. A dedicated SSH user able to run `docker`.

### Repository secrets

| Secret | Content |
|---|---|
| `SSH_HOST` | Server hostname or IP |
| `SSH_USER` | SSH user on the server |
| `SSH_KEY` | Private key (dedicated deploy key) |
| `SSH_KNOWN_HOSTS` | Output of `ssh-keyscan -t ed25519 <host>`; host key is pinned and strictly checked |
| `DEPLOY_PATH` | Optional; checkout path on the server (default `koffeinkonto`, relative to the SSH user's home) |

## Notes

- Data never leaves the device. It is written to two browser-local backends
  (`localStorage` and IndexedDB); if one is cleared or corrupted, the other
  restores it automatically.
- The app asks the browser for persistent storage. Browsers may refuse unless
  the app is installed; the UI then recommends regular backups.
- Clearing *all* site data (both backends) still erases the account. Use
  "Export backup" regularly, and "Import backup" to restore or to move the
  account to another device.
- Data is per browser and origin. The installed PWA and a normal browser tab
  may not share storage on every platform (notably iOS). On iOS, install the
  app to the home screen; Safari tabs evict unused site data after about
  seven days.
- Concurrent edits from two tabs of the same browser are last-write-wins.
