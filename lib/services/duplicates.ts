import { and, desc, eq, gte, isNull, ne } from "drizzle-orm";
import type { DB } from "@/db/client";
import * as s from "@/db/schema";

const COMPANY_SUFFIXES =
  /\b(inc|llc|ltd|limited|gmbh|sas|sarl|sa|bv|ag|oy|ab|plc|corp|corporation|co|company|labs?|technologies|technology|tech|software|group|hq|io|ai|cloud|the)\b/g;

export function normalizeCompanyName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.(com|io|dev|ai|co|net|org|tech|cloud)\b/g, "")
    .replace(COMPANY_SUFFIXES, " ")
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/\b(intern(ship)?|junior|jr|part[- ]time|remote|\(.*?\))\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

export function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Fuzzy match: same normalized name, containment, or a small edit distance. */
export function isSimilarName(a: string, b: string) {
  const x = normalizeCompanyName(a);
  const y = normalizeCompanyName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= 4 && long.includes(short)) return true;
  return levenshtein(x, y) <= Math.max(1, Math.floor(long.length / 6));
}

export function findSimilarCompanies(db: DB, name: string, excludeId?: number) {
  if (name.trim().length < 2) return [];
  const rows = db
    .select({ id: s.companies.id, name: s.companies.name, tier: s.companies.tier })
    .from(s.companies)
    .where(and(isNull(s.companies.deletedAt), excludeId ? ne(s.companies.id, excludeId) : undefined))
    .all();
  return rows.filter((r) => isSimilarName(r.name, name)).slice(0, 5);
}

export function findSameRole(db: DB, companyId: number, title: string, excludeId?: number) {
  const target = normalizeTitle(title);
  if (!target) return [];
  const rows = db
    .select({ id: s.opportunities.id, title: s.opportunities.title, status: s.opportunities.status })
    .from(s.opportunities)
    .where(
      and(
        eq(s.opportunities.companyId, companyId),
        isNull(s.opportunities.deletedAt),
        excludeId ? ne(s.opportunities.id, excludeId) : undefined,
      ),
    )
    .all();
  return rows.filter((r) => {
    const t = normalizeTitle(r.title);
    return t === target || levenshtein(t, target) <= Math.max(1, Math.floor(target.length / 8));
  });
}

/** The most recent outbound message to this contact within `days`. */
export function recentMessageToContact(db: DB, contactId: number, now = new Date(), days = 7) {
  return (
    db
      .select({ id: s.activities.id, type: s.activities.type, occurredAt: s.activities.occurredAt })
      .from(s.activities)
      .where(
        and(
          eq(s.activities.contactId, contactId),
          eq(s.activities.direction, "outbound"),
          isNull(s.activities.deletedAt),
          gte(s.activities.occurredAt, new Date(now.getTime() - days * 86_400_000)),
        ),
      )
      .orderBy(desc(s.activities.occurredAt))
      .get() ?? null
  );
}
