import fs from "node:fs/promises";
import path from "node:path";
import { LOGO_DIR, LOGO_TYPES } from "@/lib/services/favicon";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/logos/[file]">) {
  const { file } = await ctx.params;
  // Names are "<companyId>.<ext>" that we wrote; basename() guards against traversal regardless.
  const name = path.basename(file);
  const type = LOGO_TYPES[path.extname(name)];
  if (!type) return new Response("Not found", { status: 404 });
  try {
    const bytes = await fs.readFile(path.join(LOGO_DIR, name));
    return new Response(bytes, {
      headers: {
        "content-type": type,
        // The URL carries a version, so the bytes behind it never change.
        "cache-control": "private, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        // SVGs come from third-party sites: never let one run script if opened directly.
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
