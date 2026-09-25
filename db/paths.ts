import path from "node:path";

// Runtime paths, resolved against the working directory. The turbopackIgnore
// hints stop the bundler from tracing the whole project as "possible files".
const root = process.cwd();

export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.HUNT_DATA_DIR ?? path.join(root, "data"));
export const DB_PATH = path.join(/*turbopackIgnore: true*/ DATA_DIR, "hunt.db");
export const BACKUP_DIR = path.join(/*turbopackIgnore: true*/ DATA_DIR, "backups");
export const UPLOAD_DIR = path.join(/*turbopackIgnore: true*/ DATA_DIR, "uploads");
export const MIGRATIONS_DIR = path.join(/*turbopackIgnore: true*/ root, "db", "migrations");
