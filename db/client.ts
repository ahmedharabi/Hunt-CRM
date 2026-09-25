import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { DATA_DIR, DB_PATH, MIGRATIONS_DIR } from "./paths";
import { registerSqlFunctions } from "./sql-functions";

export type DB = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

/** Open a connection with the pragmas the app relies on, then apply pending migrations. */
export function createDb(file: string = DB_PATH): DB {
  if (file !== ":memory:") fs.mkdirSync(DATA_DIR, { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");
  registerSqlFunctions(sqlite);

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  sqlite.prepare("INSERT OR IGNORE INTO settings (id) VALUES (1)").run();
  return db;
}

/*
 * One connection per process. In dev, Next re-evaluates modules on every
 * hot reload, so the instance is parked on globalThis to avoid leaking
 * file handles (and WAL locks) with each edit.
 */
const globalForDb = globalThis as unknown as { __huntDb?: DB; __huntDbVersion?: number };

/** Bump when createDb's setup changes (pragmas, SQL functions) so dev reconnects. */
const CLIENT_VERSION = 2;

export function getDb(): DB {
  if (globalForDb.__huntDb && globalForDb.__huntDbVersion !== CLIENT_VERSION) {
    globalForDb.__huntDb.$client.close();
    globalForDb.__huntDb = undefined;
  }
  if (!globalForDb.__huntDb) {
    globalForDb.__huntDb = createDb();
    globalForDb.__huntDbVersion = CLIENT_VERSION;
  }
  return globalForDb.__huntDb;
}
