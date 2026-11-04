#!/usr/bin/env bash
# Runs on the VPS as root, started by the webhook deployer (VPS-Proxy repo,
# deploy/README.md) inside this checkout after the released commit is checked out.
# Needs KOFFEINKONTO_DOMAIN in ./.env on the VPS (never committed).
set -euo pipefail
export COMPOSE_PROJECT_NAME=koffeinkonto

KOFFEINKONTO_DOMAIN=''
# shellcheck source=/dev/null
[ -f .env ] && source .env
case "$KOFFEINKONTO_DOMAIN" in
  *[!A-Za-z0-9.-]*|'') echo "KOFFEINKONTO_DOMAIN missing or invalid in .env" >&2; exit 1 ;;
esac

docker compose up -d --build
docker image prune -f >/dev/null

SNIP=/opt/caddy/sites/koffeinkonto.caddy
if [ -f "$SNIP" ]; then cp "$SNIP" "$SNIP.bak"; fi
sed "s/koffeinkonto\.example\.com/$KOFFEINKONTO_DOMAIN/" caddy/koffeinkonto.caddy > "$SNIP"
if ! docker exec caddy caddy validate --config /etc/caddy/Caddyfile; then
  if [ -f "$SNIP.bak" ]; then mv "$SNIP.bak" "$SNIP"; else rm -f "$SNIP"; fi
  echo "Caddy validation failed; snippet rolled back" >&2
  exit 1
fi
rm -f "$SNIP.bak"
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
