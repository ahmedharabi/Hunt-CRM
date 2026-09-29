import pkg from "@/package.json";
import { compareVersions, RELEASES_REPO } from "@/lib/version";

export const APP_VERSION: string = pkg.version;

export type Release = { version: string; name: string; url: string; notes: string; publishedAt: string };

export type UpdateStatus =
  | { state: "disabled"; current: string }
  | { state: "error"; current: string; checkedAt: string; error: string }
  | { state: "ok"; current: string; checkedAt: string; latest: Release | null; available: boolean };

const TTL = 12 * 60 * 60 * 1000; // two checks a day is plenty
const ERROR_TTL = 60 * 60 * 1000; // back off for an hour after a failure

// One cached answer per process, parked on globalThis to survive dev reloads.
const cache = globalThis as unknown as { __huntUpdate?: { at: number; status: UpdateStatus } };

export function updateChecksEnabled(settingEnabled: boolean) {
  // HUNT_UPDATE_CHECK=0 turns it off for a whole install (e.g. in Docker).
  return settingEnabled && process.env.HUNT_UPDATE_CHECK !== "0";
}

/**
 * Asks GitHub for the latest published release. Only the request itself
 * leaves the machine; no data about you or your hunt is sent.
 */
export async function checkForUpdate({ enabled, force = false }: { enabled: boolean; force?: boolean }): Promise<UpdateStatus> {
  if (!updateChecksEnabled(enabled)) return { state: "disabled", current: APP_VERSION };
  const hit = cache.__huntUpdate;
  if (!force && hit && Date.now() - hit.at < (hit.status.state === "error" ? ERROR_TTL : TTL)) return hit.status;

  const status = await fetchLatest();
  cache.__huntUpdate = { at: Date.now(), status };
  return status;
}

async function fetchLatest(): Promise<UpdateStatus> {
  const checkedAt = new Date().toISOString();
  try {
    const res = await fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases/latest`, {
      headers: { accept: "application/vnd.github+json", "user-agent": `Hunt/${APP_VERSION}`, "x-github-api-version": "2022-11-28" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    // 404: no releases yet, or the repository isn't public.
    if (res.status === 404) return { state: "ok", current: APP_VERSION, checkedAt, latest: null, available: false };
    if (!res.ok) return { state: "error", current: APP_VERSION, checkedAt, error: `GitHub answered ${res.status}` };
    const r = (await res.json()) as { tag_name: string; name: string | null; html_url: string; body: string | null; published_at: string };
    const latest: Release = {
      version: r.tag_name.replace(/^v/i, ""),
      name: r.name || r.tag_name,
      url: r.html_url,
      notes: r.body ?? "",
      publishedAt: r.published_at,
    };
    return { state: "ok", current: APP_VERSION, checkedAt, latest, available: compareVersions(latest.version, APP_VERSION) > 0 };
  } catch (error) {
    const offline = error instanceof Error && (error.name === "TimeoutError" || /fetch failed|ENOTFOUND|ECONNREFUSED/.test(error.message));
    return { state: "error", current: APP_VERSION, checkedAt, error: offline ? "Couldn't reach GitHub" : "Update check failed" };
  }
}
