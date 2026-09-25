import { getDb } from "@/db/client";
import { exportBackup } from "@/lib/services/backup";

export const dynamic = "force-dynamic";

export function GET() {
  const backup = exportBackup(getDb());
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="hunt-backup-${stamp}.json"`,
    },
  });
}
