// Nightly SQLite snapshot. VACUUM INTO gives a consistent copy while the API keeps running.
import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DB_PATH = process.env.DATABASE_PATH ?? '/var/lib/chauffr/data/chauffr.db';
const BACKUP_DIR = process.env.BACKUP_DIR ?? '/var/lib/chauffr/backups';
const KEEP_DAYS = 14;

const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const target = join(BACKUP_DIR, `chauffr-${stamp}.db`);

const db = new DatabaseSync(DB_PATH);
db.prepare('VACUUM INTO ?').run(target);
db.close();
console.log(`Backed up to ${target}`);

const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
for (const file of readdirSync(BACKUP_DIR)) {
  const path = join(BACKUP_DIR, file);
  if (file.startsWith('chauffr-') && statSync(path).mtimeMs < cutoff) {
    unlinkSync(path);
    console.log(`Removed old backup ${file}`);
  }
}
