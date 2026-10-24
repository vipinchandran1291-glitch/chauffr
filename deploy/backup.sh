#!/usr/bin/env bash
# Nightly SQLite backup. Install sqlite3 (apt install sqlite3), then add to the chauffr user's crontab:
#   15 3 * * * /srv/chauffr/deploy/backup.sh
# Copy the backup folder off the server too (rclone, rsync, or object storage); a backup on the same disk isn't enough.
set -euo pipefail

DB=/srv/chauffr/apps/server/data/chauffr.db
DEST=/srv/chauffr-backups
KEEP_DAYS=14

mkdir -p "$DEST"
# .backup is safe while the server is running, unlike copying the file.
sqlite3 "$DB" ".backup '$DEST/chauffr-$(date +%F).db'"
gzip -f "$DEST/chauffr-$(date +%F).db"
find "$DEST" -name 'chauffr-*.db.gz' -mtime +"$KEEP_DAYS" -delete
