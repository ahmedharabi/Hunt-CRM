/**
 * Runs once when the server boots. Opening the DB applies pending
 * migrations, so the first request never races a schema change.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getDb } = await import("./db/client");
  getDb();
}
