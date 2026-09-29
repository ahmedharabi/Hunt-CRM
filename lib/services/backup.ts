import type { DB } from "@/db/client";

/**
 * Tables in foreign-key order: parents first. Import inserts in this
 * order and deletes in reverse. search_index is rebuilt by triggers.
 */
export const BACKUP_TABLES = [
  "settings",
  "tags",
  "companies",
  "company_tags",
  "contacts",
  "resume_versions",
  "templates",
  "opportunities",
  "opportunity_contacts",
  "opportunity_tags",
  "status_history",
  "activities",
  "interviews",
  "interview_contacts",
  "weekly_reviews",
  "notes",
  "saved_views",
] as const;

export const BACKUP_VERSION = 1;

export type Backup = {
  app: "hunt";
  version: number;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
};

export function exportBackup(db: DB): Backup {
  const tables: Backup["tables"] = {};
  for (const t of BACKUP_TABLES) {
    tables[t] = db.$client.prepare(`select * from ${t}`).all() as Record<string, unknown>[];
  }
  return { app: "hunt", version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables };
}

export function validateBackup(data: unknown): Backup {
  const b = data as Backup;
  if (!b || typeof b !== "object" || b.app !== "hunt" || typeof b.tables !== "object") {
    throw new Error("This file isn't a Hunt backup.");
  }
  if (b.version > BACKUP_VERSION) throw new Error("This backup is from a newer version of Hunt.");
  for (const t of Object.keys(b.tables)) {
    if (!(BACKUP_TABLES as readonly string[]).includes(t)) throw new Error(`Unknown table in backup: ${t}`);
    if (!Array.isArray(b.tables[t])) throw new Error(`Malformed table in backup: ${t}`);
  }
  return b;
}

/** Replace everything with the backup's contents, atomically. */
export function importBackup(db: DB, backup: Backup) {
  const sqlite = db.$client;
  const columns = (table: string) =>
    new Set((sqlite.prepare(`pragma table_info(${table})`).all() as { name: string }[]).map((c) => c.name));

  const counts: Record<string, number> = {};
  sqlite.transaction(() => {
    for (const t of [...BACKUP_TABLES].reverse()) sqlite.prepare(`delete from ${t}`).run();
    for (const t of BACKUP_TABLES) {
      const rows = backup.tables[t] ?? [];
      const allowed = columns(t);
      for (const row of rows) {
        const keys = Object.keys(row).filter((k) => allowed.has(k));
        if (!keys.length) continue;
        sqlite
          .prepare(`insert into ${t} (${keys.map((k) => `"${k}"`).join(",")}) values (${keys.map((k) => `@${k}`).join(",")})`)
          .run(Object.fromEntries(keys.map((k) => [k, row[k] as unknown])));
      }
      counts[t] = rows.length;
    }
    sqlite.prepare("insert or ignore into settings (id) values (1)").run();
  })();
  return counts;
}

/** Wipe all data (keeps the schema and default settings). */
export function resetDatabase(db: DB) {
  const sqlite = db.$client;
  sqlite.transaction(() => {
    for (const t of [...BACKUP_TABLES].reverse()) sqlite.prepare(`delete from ${t}`).run();
    sqlite.prepare("insert into settings (id) values (1)").run();
  })();
}
