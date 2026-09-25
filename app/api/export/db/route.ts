import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getDb } from "@/db/client";

export const dynamic = "force-dynamic";

/** Consistent snapshot via SQLite's backup API (safe while WAL is active). */
export async function GET() {
  const tmp = path.join(os.tmpdir(), `hunt-${Date.now()}.db`);
  try {
    await getDb().$client.backup(tmp);
    const bytes = await fs.readFile(tmp);
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(bytes, {
      headers: {
        "content-type": "application/vnd.sqlite3",
        "content-disposition": `attachment; filename="hunt-${stamp}.db"`,
      },
    });
  } finally {
    await fs.rm(tmp, { force: true });
  }
}
