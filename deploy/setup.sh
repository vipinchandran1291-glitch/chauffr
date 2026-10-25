#!/usr/bin/env bash
# One-time server setup for Chauffr. Safe to re-run. Run as root on the VPS.
# Assumes Node 24+ and Caddy are already installed.
set -euo pipefail

REPO=https://github.com/vipinchandran1291-glitch/chauffr.git
APP_DIR=/srv/chauffr

id chauffr &>/dev/null || useradd --system --create-home --home-dir /var/lib/chauffr --shell /usr/sbin/nologin chauffr
install -d -o chauffr -g chauffr -m 750 /var/lib/chauffr /var/lib/chauffr/data /var/lib/chauffr/backups

if [ ! -d "$APP_DIR/.git" ]; then
  install -d -o chauffr -g chauffr -m 755 "$APP_DIR"
  sudo -u chauffr -H git clone "$REPO" "$APP_DIR"
fi

if [ ! -f /etc/chauffr/env ]; then
  install -d -m 750 -g chauffr /etc/chauffr
  cat > /etc/chauffr/env <<'EOF'
PORT=3010
DATABASE_PATH=/var/lib/chauffr/data/chauffr.db
# Google OAuth web client ID. Authorized JavaScript origin: https://chauffr.vipinlabs.tech
GOOGLE_CLIENT_ID=
# Comma-separated Google emails allowed into /admin
ADMIN_EMAILS=
DEV_LOGIN=false
EOF
  chmod 640 /etc/chauffr/env
  chgrp chauffr /etc/chauffr/env
fi

install -m 644 "$APP_DIR/deploy/chauffr.service" /etc/systemd/system/chauffr.service
install -m 644 "$APP_DIR/deploy/chauffr-backup.service" /etc/systemd/system/chauffr-backup.service
install -m 644 "$APP_DIR/deploy/chauffr-backup.timer" /etc/systemd/system/chauffr-backup.timer
systemctl daemon-reload
systemctl enable chauffr chauffr-backup.timer

# Caddy: keep Chauffr in its own file so other sites in the Caddyfile are untouched.
install -d -m 755 /etc/caddy/sites
install -m 644 "$APP_DIR/deploy/chauffr.caddy" /etc/caddy/sites/chauffr.caddy
grep -qxF 'import sites/*.caddy' /etc/caddy/Caddyfile || printf '\nimport sites/*.caddy\n' >> /etc/caddy/Caddyfile

"$APP_DIR/deploy/deploy.sh"
systemctl start chauffr-backup.timer
