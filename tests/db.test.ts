import { describe, expect, it } from "vitest";
import { asc, eq, sql } from "drizzle-orm";
import * as s from "@/db/schema";
import { clearSeed, countRealRows, seed } from "@/db/seed-data";
import { canTransition, DEFAULT_DAILY_GOALS } from "@/lib/domain";
import { testDb } from "./helpers";

const NOW = new Date("2026-09-24T14:00:00Z");

describe("migrations", () => {
  it("creates the schema and a default settings row", () => {
    const db = testDb();
    const row = db.select().from(s.settings).get();
    expect(row).toMatchObject({ id: 1, timezone: "Africa/Tunis", weekStartsOn: 1, ghostingThresholdDays: 21 });
    expect(row?.dailyGoals).toEqual(DEFAULT_DAILY_GOALS);
  });

  it("enforces foreign keys", () => {
    const db = testDb();
    expect(() =>
      db.insert(s.opportunities).values({ companyId: 999, title: "Orphan" }).run(),
    ).toThrow(/FOREIGN KEY/);
  });

  it("stores timestamps as integer milliseconds", () => {
    const db = testDb();
    db.insert(s.companies).values({ name: "Acme" }).run();
    const raw = db.$client.prepare("select created_at, typeof(created_at) t from companies").get() as {
      created_at: number;
      t: string;
    };
    expect(raw.t).toBe("integer");
    expect(Math.abs(raw.created_at - Date.now())).toBeLessThan(5_000);
  });
});

describe("seed", () => {
  it("produces a realistic dataset, all flagged is_seed", () => {
    const db = testDb();
    const counts = seed(db, { now: NOW });
    expect(counts.companies).toBeGreaterThanOrEqual(40);
    expect(counts.opportunities).toBeGreaterThan(30);
    expect(counts.activities).toBeGreaterThan(200);
    expect(countRealRows(db)).toBe(0);

    const statuses = db.select({ status: s.opportunities.status }).from(s.opportunities).groupBy(s.opportunities.status).all();
    expect(statuses.length).toBeGreaterThanOrEqual(7);
  });

  it("spans roughly three months and never writes activities in the future", () => {
    const db = testDb();
    seed(db, { now: NOW });
    const { min, max } = db
      .select({ min: sql<number>`min(${s.activities.occurredAt})`, max: sql<number>`max(${s.activities.occurredAt})` })
      .from(s.activities)
      .get()!;
    expect(max).toBeLessThanOrEqual(NOW.getTime());
    expect((NOW.getTime() - min) / 86_400_000).toBeGreaterThan(80);
  });

  it("writes status history that follows allowed transitions and ends at the current status", () => {
    const db = testDb();
    seed(db, { now: NOW });
    const opps = db.query.opportunities
      .findMany({ with: { statusHistory: { orderBy: asc(s.statusHistory.changedAt) } } })
      .sync();
    for (const opp of opps) {
      const h = opp.statusHistory;
      expect(h[0].fromStatus).toBeNull();
      expect(h.at(-1)!.toStatus).toBe(opp.status);
      for (let i = 1; i < h.length; i++) {
        expect(h[i].fromStatus).toBe(h[i - 1].toStatus);
        expect(canTransition(h[i].fromStatus!, h[i].toStatus), `${h[i].fromStatus} → ${h[i].toStatus}`).toBe(true);
      }
    }
  });

  it("links replies and follow-ups to their original outreach", () => {
    const db = testDb();
    seed(db, { now: NOW });
    const orphans = db.$client
      .prepare(
        `select count(*) n from activities a join activities p on p.id = a.parent_activity_id
         where a.company_id is not p.company_id or a.occurred_at < p.occurred_at`,
      )
      .get() as { n: number };
    expect(orphans.n).toBe(0);
  });

  it("is re-runnable and clearSeed never touches real rows", () => {
    const db = testDb();
    seed(db, { now: NOW });
    const [mine] = db.insert(s.companies).values({ name: "My real company" }).returning().all();
    expect(countRealRows(db)).toBe(1);

    seed(db, { now: NOW }); // replaces seed rows only
    clearSeed(db);
    const left = db.select().from(s.companies).all();
    expect(left.map((c) => c.id)).toEqual([mine.id]);
    expect(db.select().from(s.activities).where(eq(s.activities.isSeed, true)).all()).toHaveLength(0);
  });
});
