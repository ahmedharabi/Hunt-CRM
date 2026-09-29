import { getSettings } from "@/lib/queries/settings";
import { checkForUpdate } from "@/lib/services/updates";

export const dynamic = "force-dynamic";

/** Fetched by the client after the page loads, so a slow GitHub never delays a render. `?force` skips the cache. */
export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.has("force");
  return Response.json(await checkForUpdate({ enabled: getSettings().checkUpdates, force }));
}
