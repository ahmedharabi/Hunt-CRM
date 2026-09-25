import fs from "node:fs";
import path from "node:path";
import { formatInTimeZone } from "date-fns-tz";
import { getDb } from "./client";
import { BACKUP_DIR } from "./paths";

const KEEP = 14;
let lastBackupDay: string | null = null;
let running: Promise<void> | null = null;

/**
 * Snapshot the DB once per calendar day (first request of the day wins).
 * Uses SQLite's online backup API, which is safe while the DB is in WAL
 * mode and being written to — a plain file copy is not.
 */
export function ensureDailyBackup(timezone = "Africa/Tunis"): Promise<void> {
  const day = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
  if (lastBackupDay === day) return Promise.resolve();
  running ??= (async () => {
    try {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const target = path.join(BACKUP_DIR, `hunt-${day}.db`);
      if (!fs.existsSync(target)) {
        await getDb().$client.backup(target);
      }
      prune();
      lastBackupDay = day;
    } catch (error) {
      console.error("[hunt] daily backup failed", error);
    } finally {
      running = null;
    }
  })();
  return running;
}

function prune() {
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => /^hunt-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort();
  for (const file of files.slice(0, Math.max(0, files.length - KEEP))) {
    fs.rmSync(path.join(BACKUP_DIR, file), { force: true });
  }
}
