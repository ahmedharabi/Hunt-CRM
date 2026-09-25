import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { resumeVersions } from "@/db/schema";
import { UPLOAD_DIR } from "@/db/paths";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(_req: Request, ctx: RouteContext<"/api/resumes/[id]">) {
  const { id } = await ctx.params;
  const row = getDb().select().from(resumeVersions).where(eq(resumeVersions.id, Number(id))).get();
  if (!row?.filePath) return new Response("Not found", { status: 404 });
  const [stored, original] = row.filePath.split("|");
  // stored names are UUIDs we generated; basename() guards against traversal regardless.
  const file = path.join(UPLOAD_DIR, path.basename(stored));
  try {
    const bytes = await fs.readFile(file);
    return new Response(bytes, {
      headers: {
        "content-type": TYPES[path.extname(stored)] ?? "application/octet-stream",
        "content-disposition": `inline; filename="${original ?? stored}"`,
      },
    });
  } catch {
    return new Response("File missing from ./data/uploads", { status: 404 });
  }
}
