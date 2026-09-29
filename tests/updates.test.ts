import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compareVersions } from "@/lib/version";
import { APP_VERSION, checkForUpdate } from "@/lib/services/updates";

describe("compareVersions", () => {
  it("orders versions numerically, ignoring a v prefix and pre-release tags", () => {
    expect(compareVersions("0.2.0", "0.1.9")).toBeGreaterThan(0);
    expect(compareVersions("v0.10.0", "0.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("v1.2.3-beta.1", "1.2.3")).toBe(0);
    expect(compareVersions("0.1.0", "0.1.1")).toBeLessThan(0);
  });
});

describe("checkForUpdate", () => {
  const release = (tag: string) =>
    new Response(JSON.stringify({ tag_name: tag, name: `Hunt ${tag}`, html_url: `https://github.com/x/releases/${tag}`, body: "- New", published_at: "2026-10-01T00:00:00Z" }));

  beforeEach(() => {
    delete (globalThis as { __huntUpdate?: unknown }).__huntUpdate;
    delete process.env.HUNT_UPDATE_CHECK;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reports a newer release", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => release("v99.0.0")));
    const s = await checkForUpdate({ enabled: true });
    expect(s).toMatchObject({ state: "ok", current: APP_VERSION, available: true, latest: { version: "99.0.0", notes: "- New" } });
  });

  it("says up to date when the latest release is this version", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => release(`v${APP_VERSION}`)));
    expect(await checkForUpdate({ enabled: true })).toMatchObject({ state: "ok", available: false });
  });

  it("caches the answer until forced", async () => {
    const fetch = vi.fn(async () => release("v99.0.0"));
    vi.stubGlobal("fetch", fetch);
    await checkForUpdate({ enabled: true });
    await checkForUpdate({ enabled: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    await checkForUpdate({ enabled: true, force: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("treats a 404 (no releases, or a private repo) as nothing to report", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    expect(await checkForUpdate({ enabled: true })).toMatchObject({ state: "ok", latest: null, available: false });
  });

  it("reports network failures without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect(await checkForUpdate({ enabled: true })).toMatchObject({ state: "error", error: "Couldn't reach GitHub" });
  });

  it("never calls GitHub when turned off", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await checkForUpdate({ enabled: false })).toEqual({ state: "disabled", current: APP_VERSION });
    process.env.HUNT_UPDATE_CHECK = "0";
    expect((await checkForUpdate({ enabled: true })).state).toBe("disabled");
    expect(fetch).not.toHaveBeenCalled();
  });
});
