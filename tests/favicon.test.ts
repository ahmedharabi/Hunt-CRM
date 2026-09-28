import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFavicon, iconCandidates, isPublicUrl } from "@/lib/services/favicon";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

describe("iconCandidates", () => {
  it("ranks apple-touch-icon and large sizes first and resolves relative links", () => {
    const html = `<head>
      <link rel="icon" href="/favicon-16.png" sizes="16x16">
      <link rel='apple-touch-icon' href='/apple.png'>
      <link rel="mask-icon" href="/mask.svg">
      <link href="https://cdn.acme.dev/icon-96.png" rel="icon" sizes="96x96">
      <link rel="stylesheet" href="/app.css">
    </head>`;
    expect(iconCandidates(html, new URL("https://acme.dev/about")).map(String)).toEqual([
      "https://acme.dev/apple.png",
      "https://cdn.acme.dev/icon-96.png",
      "https://acme.dev/favicon-16.png",
    ]);
  });
});

describe("isPublicUrl", () => {
  it("refuses local and private network hosts", () => {
    for (const u of ["http://localhost:3000", "http://127.0.0.1", "http://192.168.1.1/x", "http://10.0.0.2", "http://172.20.0.1", "http://[::1]/", "file:///etc/passwd", "http://printer.local"]) {
      expect(isPublicUrl(new URL(u)), u).toBe(false);
    }
    // Hostnames that merely look like private prefixes are fine.
    for (const u of ["https://acme.dev", "https://fdm.com", "https://fcbarcelona.com", "https://10x.company", "https://127labs.io"]) {
      expect(isPublicUrl(new URL(u)), u).toBe(true);
    }
  });
});

describe("fetchFavicon", () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (routes: Record<string, { body: BodyInit; type: string }>) =>
    vi.fn(async (url: URL) => {
      const hit = routes[String(url)];
      const res = hit ? new Response(hit.body, { headers: { "content-type": hit.type } }) : new Response("nope", { status: 404 });
      Object.defineProperty(res, "url", { value: String(url) });
      return res;
    });

  it("uses the icon the page declares", async () => {
    vi.stubGlobal("fetch", respond({
      "https://acme.dev/": { body: `<link rel="icon" href="/logo.png">`, type: "text/html" },
      "https://acme.dev/logo.png": { body: PNG, type: "image/png" },
    }));
    expect(await fetchFavicon("https://acme.dev")).toMatchObject({ ext: ".png" });
  });

  it("falls back to /favicon.ico and sniffs the type when the server mislabels it", async () => {
    vi.stubGlobal("fetch", respond({
      "https://acme.dev/": { body: "<html></html>", type: "text/html" },
      "https://acme.dev/favicon.ico": { body: PNG, type: "application/octet-stream" },
    }));
    expect(await fetchFavicon("https://acme.dev")).toMatchObject({ ext: ".png" });
  });

  it("finds icons at the top of a page larger than the read limit", async () => {
    vi.stubGlobal("fetch", respond({
      "https://acme.dev/": { body: `<head><link rel="icon" href="/logo.png"></head>` + "x".repeat(2_000_000), type: "text/html" },
      "https://acme.dev/logo.png": { body: PNG, type: "image/png" },
    }));
    expect(await fetchFavicon("https://acme.dev")).toMatchObject({ ext: ".png" });
  });

  it("returns null when nothing is an image", async () => {
    vi.stubGlobal("fetch", respond({
      "https://acme.dev/": { body: `<link rel="icon" href="/x.png">`, type: "text/html" },
      "https://acme.dev/x.png": { body: "<html>login</html>", type: "text/html" },
    }));
    expect(await fetchFavicon("https://acme.dev")).toBeNull();
  });
});
