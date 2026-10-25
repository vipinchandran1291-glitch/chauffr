#!/usr/bin/env bash
# Pull the latest main, build, restart. Run as root on the VPS.
set -euo pipefail
cd /srv/chauffr

sudo -u chauffr -H git pull --ff-only
sudo -u chauffr -H npm ci --no-audit --no-fund
sudo -u chauffr -H npm run build

install -m 644 deploy/chauffr.caddy /etc/caddy/sites/chauffr.caddy
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy

systemctl restart chauffr
for _ in $(seq 1 20); do
  curl -fsS http://127.0.0.1:3010/api/health >/dev/null 2>&1 && { echo "Chauffr is up"; exit 0; }
  sleep 0.5
done
echo "Chauffr did not become healthy; recent logs:" >&2
journalctl -u chauffr -n 30 --no-pager >&2
exit 1
