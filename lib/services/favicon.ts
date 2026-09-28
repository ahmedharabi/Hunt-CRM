import fs from "node:fs/promises";
import path from "node:path";
import { and, eq, isNotNull, isNull, like, or } from "drizzle-orm";
import type { DB } from "@/db/client";
import * as s from "@/db/schema";
import { UPLOAD_DIR } from "@/db/paths";

/*
 * Company logos from the company's own website: the icons its homepage
 * declares (largest first), then /favicon.ico. Fetched once, straight from
 * the site (no third-party favicon service), and stored under
 * data/uploads/logos so pages never hit the network to show them.
 */

export const LOGO_DIR = path.join(UPLOAD_DIR, "logos");
export const LOGO_ROUTE = "/api/logos/";

const TIMEOUT_MS = 5000;
const MAX_HTML = 512 * 1024;
const MAX_ICON = 256 * 1024;

const EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "image/x-icon": ".ico",
  "image/vnd.microsoft.icon": ".ico",
};
export const LOGO_TYPES = Object.fromEntries(Object.entries(EXT).map(([type, ext]) => [ext, type]));

/** Only public http(s) hosts: the page a site serves shouldn't make us fetch from the local network. */
export function isPublicUrl(u: URL) {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    return !(/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h));
  }
  if (h.includes(":")) return !(h === "::1" || h === "::" || /^(fc|fd|fe80)/.test(h) || h.startsWith("::ffff:"));
  return true;
}

/**
 * GET with a size cap. `truncate` keeps the first `max` bytes instead of
 * giving up (pages: the icon links are in <head>, at the top).
 */
async function get(url: URL, max: number, accept: string, truncate = false) {
  if (!isPublicUrl(url)) return null;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "Mozilla/5.0 (compatible; Hunt/1.0; +favicon)", accept },
    });
    if (!res.ok || !res.body || !isPublicUrl(new URL(res.url))) return null;
    if (!truncate && Number(res.headers.get("content-length") ?? 0) > max) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = res.body.getReader();
    while (size <= max) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
    if (size > max) {
      await reader.cancel();
      if (!truncate) return null;
    }
    const bytes = Buffer.concat(chunks).subarray(0, max);
    if (bytes.byteLength === 0) return null;
    return { bytes, type: (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase(), url: new URL(res.url) };
  } catch {
    return null;
  }
}

/** Icon links declared in the page, best first: apple-touch-icon, then by declared size. */
export function iconCandidates(html: string, base: URL): URL[] {
  const found: { url: URL; score: number }[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attr = (name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(2).find((v) => v !== undefined);
    const rel = attr("rel")?.toLowerCase() ?? "";
    const href = attr("href");
    if (!href || !/\b(icon|apple-touch-icon)\b/.test(rel) || rel.includes("mask-icon")) continue;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    const size = Math.max(0, ...(attr("sizes") ?? "").split(/\s+/).map((v) => Number(v.split("x")[0]) || 0));
    const score = (rel.includes("apple-touch-icon") ? 180 : size || 32) + (url.pathname.endsWith(".svg") ? 100 : 0);
    found.push({ url, score });
  }
  return found.sort((a, b) => b.score - a.score).map((f) => f.url);
}

function sniffType(bytes: Uint8Array, declared: string) {
  if (EXT[declared]) return declared;
  const head = Buffer.from(bytes.subarray(0, 64));
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (head[0] === 0xff && head[1] === 0xd8) return "image/jpeg";
  if (head.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))) return "image/x-icon";
  if (head.toString("latin1", 0, 4) === "GIF8") return "image/gif";
  if (head.toString("latin1", 0, 4) === "RIFF" && head.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Downloads the best icon for `website`, or null if none could be fetched. */
export async function fetchFavicon(website: string): Promise<{ bytes: Uint8Array; ext: string } | null> {
  let site: URL;
  try {
    site = new URL(website);
  } catch {
    return null;
  }
  const page = await get(site, MAX_HTML, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", true);
  const base = page?.url ?? site;
  const html = page && page.type.includes("html") ? new TextDecoder().decode(page.bytes) : "";
  const candidates = [...iconCandidates(html, base), new URL("/favicon.ico", base)];
  for (const url of candidates.slice(0, 6)) {
    const icon = await get(url, MAX_ICON, "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5");
    if (!icon) continue;
    const type = sniffType(icon.bytes, icon.type);
    if (type) return { bytes: icon.bytes, ext: EXT[type] };
  }
  return null;
}

/** Fetches and stores a logo for one company, if it has a website and no logo yet. */
export async function fillCompanyLogo(db: DB, companyId: number) {
  const company = db.select().from(s.companies).where(eq(s.companies.id, companyId)).get();
  if (!company?.website || company.logoUrl) return false;
  const icon = await fetchFavicon(company.website);
  if (!icon) return false;
  await fs.mkdir(LOGO_DIR, { recursive: true });
  const file = `${companyId}${icon.ext}`;
  await fs.writeFile(path.join(LOGO_DIR, file), icon.bytes);
  // Only set it if nobody picked a logo meanwhile; the version busts browser caches.
  db.update(s.companies)
    .set({ logoUrl: `${LOGO_ROUTE}${file}?v=${Date.now()}` })
    .where(and(eq(s.companies.id, companyId), or(isNull(s.companies.logoUrl), eq(s.companies.logoUrl, ""))))
    .run();
  return true;
}

/** After the website changed: drop a logo we fetched ourselves (not one the user chose), then fetch again. */
export async function refreshCompanyLogo(db: DB, companyId: number) {
  db.update(s.companies)
    .set({ logoUrl: null })
    .where(and(eq(s.companies.id, companyId), like(s.companies.logoUrl, `${LOGO_ROUTE}%`)))
    .run();
  return fillCompanyLogo(db, companyId);
}

/** Companies that have a website but no logo, for the backfill button. */
export function companiesMissingLogos(db: DB) {
  return db
    .select({ id: s.companies.id })
    .from(s.companies)
    .where(and(isNull(s.companies.deletedAt), isNotNull(s.companies.website), or(isNull(s.companies.logoUrl), eq(s.companies.logoUrl, ""))))
    .all()
    .map((r) => r.id);
}
