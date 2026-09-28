import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/db/paths";
import { BACKGROUND_TYPES } from "@/lib/appearance";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/backgrounds/[file]">) {
  const { file } = await ctx.params;
  // Stored names are UUIDs we generated; basename() guards against traversal regardless.
  const name = path.basename(file);
  const type = BACKGROUND_TYPES[path.extname(name).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });
  try {
    const bytes = await fs.readFile(path.join(UPLOAD_DIR, "backgrounds", name));
    return new Response(bytes, {
      headers: {
        "content-type": type,
        // A new upload gets a new name, so a given URL never changes.
        "cache-control": "private, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
