import { createDb } from "./client";
import { DB_PATH } from "./paths";

// Opening the DB applies any pending migrations (see createDb).
const db = createDb();
db.$client.close();
console.log(`✓ migrations applied → ${DB_PATH}`);
