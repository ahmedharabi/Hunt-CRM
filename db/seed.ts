import { createDb } from "./client";
import { clearSeed, countRealRows, seed } from "./seed-data";

const args = new Set(process.argv.slice(2));
const db = createDb();

try {
  if (args.has("--clear")) {
    clearSeed(db);
    console.log("✓ removed all seeded rows (your own data is untouched)");
    process.exit(0);
  }

  const real = countRealRows(db);
  if (real > 0 && !args.has("--force")) {
    console.error(
      `✗ refusing to seed: the database already has ${real} row(s) you created.\n` +
        "  Re-run with --force to add sample data alongside them (only is_seed rows are replaced),\n" +
        "  or `npm run db:seed -- --clear` to remove sample data.",
    );
    process.exit(1);
  }

  const counts = seed(db);
  console.log("✓ seeded", counts);
} finally {
  db.$client.close();
}
