import { beforeEach, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import type { DB } from "@/db/client";
import * as A from "@/lib/services/analytics";
import { computeStreaks, dayMeetsGoal, groupFollowUps, followUpsDue, streakTargets } from "@/lib/services/dashboard";
import { getWeeklyReview, weekBounds } from "@/lib/services/review";
import { exportBackup, importBackup, validateBackup } from "@/lib/services/backup";
import { localParts } from "@/db/sql-functions";
import type { ActivityType, Channel, OpportunityStatus } from "@/lib/domain";
import { testDb } from "./helpers";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const TZ = "Africa/Tunis";
const NOW = new Date("2026-09-24T12:00:00Z");

let db: DB;
let ids: { dream: number; backup: number; tpl: number; resume: number };

function send(type: ActivityType, channel: Channel, at: number, opts: { companyId?: number; opportunityId?: number; templateId?: number; replyAfterHours?: number; isSeed?: boolean } = {}) {
  const root = db
    .insert(s.activities)
    .values({ type, channel, direction: "outbound", companyId: opts.companyId ?? ids.dream, opportunityId: opts.opportunityId, templateId: opts.templateId, occurredAt: new Date(at), isSeed: opts.isSeed ?? false })
    .returning()
    .get();
  if (opts.replyAfterHours !== undefined) {
    db.insert(s.activities)
      .values({ type, channel, direction: "inbound", companyId: root.companyId, parentActivityId: root.id, occurredAt: new Date(at + opts.replyAfterHours * HOUR), isSeed: opts.isSeed ?? false })
      .run();
  }
  return root;
}

function walk(opportunityId: number, statuses: OpportunityStatus[], start: number, gapDays: number) {
  statuses.forEach((to, i) =>
    db.insert(s.statusHistory)
      .values({ opportunityId, fromStatus: i ? statuses[i - 1] : null, toStatus: to, changedAt: new Date(start + i * gapDays * DAY) })
      .run(),
  );
}

const ctx = (from: Date | null = null, includeSeed = false): A.Ctx => ({ db, tz: TZ, range: { from, to: NOW }, includeSeed });

beforeEach(() => {
  db = testDb();
  const dream = db.insert(s.companies).values({ name: "Dream Co", tier: "dream", industry: "Observability", country: "France", techStack: ["Go", "Kubernetes"] }).returning().get().id;
  const backup = db.insert(s.companies).values({ name: "Backup Co", tier: "backup", industry: "Fintech", country: "Tunisia", techStack: ["Java"] }).returning().get().id;
  const tpl = db.insert(s.templates).values({ name: "Cold v1", type: "cold_email", body: "hi" }).returning().get().id;
  const resume = db.insert(s.resumeVersions).values({ name: "CV v2" }).returning().get().id;
  ids = { dream, backup, tpl, resume };
});

describe("reply metrics", () => {
  beforeEach(() => {
    const t0 = NOW.getTime() - 10 * DAY;
    // 4 emails (2 replied at 24h and 48h), 2 DMs (1 replied at 6h)
    send("cold_email", "email", t0, { templateId: ids.tpl, replyAfterHours: 24 });
    send("cold_email", "email", t0, { templateId: ids.tpl, replyAfterHours: 48, companyId: ids.backup });
    send("cold_email", "email", t0, { templateId: ids.tpl });
    send("cold_email", "email", t0);
    const dm = send("linkedin_dm", "linkedin", t0, { replyAfterHours: 6 });
    send("linkedin_dm", "linkedin", t0);
    // follow-ups and interviews are not outreach
    db.insert(s.activities).values({ type: "follow_up", channel: "linkedin", direction: "outbound", companyId: ids.dream, parentActivityId: dm.id, occurredAt: new Date(t0 + DAY) }).run();
    db.insert(s.activities).values({ type: "interview", channel: "phone", direction: "outbound", companyId: ids.dream, occurredAt: new Date(t0) }).run();
    // outside the range
    send("cold_email", "email", NOW.getTime() - 60 * DAY, { replyAfterHours: 1 });
  });

  it("counts outreach as root outbound messages only", () => {
    expect(A.kpis(ctx(new Date(NOW.getTime() - 30 * DAY))).current).toMatchObject({ outreach: 6, replies: 3, replyRate: 0.5 });
    expect(A.kpis(ctx()).current.outreach).toBe(7);
  });

  it("compares with the previous period of equal length", () => {
    const { previous } = A.kpis(ctx(new Date(NOW.getTime() - 30 * DAY)));
    expect(previous).toMatchObject({ outreach: 1, replies: 1 });
  });

  it("computes reply rate by channel and tier", () => {
    const byChannel = A.replyRateByChannel(ctx(new Date(NOW.getTime() - 30 * DAY)));
    expect(byChannel).toEqual([
      { key: "email", sent: 4, replied: 2, rate: 0.5 },
      { key: "linkedin", sent: 2, replied: 1, rate: 0.5 },
    ]);
    const byTier = A.replyRateByTier(ctx(new Date(NOW.getTime() - 30 * DAY)));
    expect(byTier).toEqual([
      { key: "dream", sent: 5, replied: 2, rate: 0.4 },
      { key: "backup", sent: 1, replied: 1, rate: 1 },
    ]);
  });

  it("averages time to first reply per channel", () => {
    const rows = A.timeToFirstReply(ctx(new Date(NOW.getTime() - 30 * DAY)));
    expect(rows.find((r) => r.key === "email")).toMatchObject({ n: 2, avgHours: 36, minHours: 24, maxHours: 48 });
    expect(rows.find((r) => r.key === "linkedin")).toMatchObject({ n: 1, avgHours: 6 });
  });

  it("scores templates by sends and replies", () => {
    expect(A.templatePerformance(ctx())).toEqual([{ key: "Cold v1", id: ids.tpl, sent: 3, replied: 2, rate: 2 / 3 }]);
  });

  it("buckets the send-time heatmap in local time", () => {
    const cells = A.sendTimeHeatmap(ctx(new Date(NOW.getTime() - 30 * DAY)));
    const t0 = localParts(NOW.getTime() - 10 * DAY, TZ);
    expect(cells).toEqual([{ dow: t0.dow, hour: t0.hour, sent: 6, replied: 3 }]);
    expect(t0.hour).toBe(13); // 12:00 UTC is 13:00 in Tunis
  });

  it("finds industries, stacks and countries that reply", () => {
    const c = ctx(new Date(NOW.getTime() - 30 * DAY));
    expect(A.topIndustries(c).map((r) => r.key)).toEqual(["Observability", "Fintech"]);
    expect(A.topTechStacks(c).map((r) => r.key).sort()).toEqual(["Go", "Java", "Kubernetes"]);
    expect(A.replyRateByCountry(c)[0]).toMatchObject({ key: "France", sent: 5 });
  });

  it("fills every day in the per-day series", () => {
    const series = A.activitiesPerDay(ctx(new Date(NOW.getTime() - 14 * DAY)));
    expect(series).toHaveLength(15);
    const busy = series.find((d) => d.cold_email);
    expect(busy).toMatchObject({ cold_email: 4, linkedin_dm: 2, interview: 1 });
  });
});

describe("pipeline metrics", () => {
  it("builds the funnel from history, counting stage skips as passing through", () => {
    const t = NOW.getTime() - 40 * DAY;
    const mk = (path: OpportunityStatus[], resume?: number) => {
      const o = db.insert(s.opportunities).values({ companyId: ids.dream, title: "R", status: path.at(-1), appliedAt: new Date(t), resumeVersionId: resume }).returning().get();
      walk(o.id, path, t, 4);
      return o;
    };
    mk(["wishlist", "applied", "screening", "interviewing", "offer"], ids.resume);
    mk(["applied", "interviewing", "rejected"], ids.resume);
    mk(["applied", "screening", "rejected"], ids.resume);
    mk(["applied", "ghosted"]);

    const f = A.funnel(ctx());
    expect(f.map((x) => [x.stage, x.count])).toEqual([
      ["applied", 4],
      ["screening", 3],
      ["interviewing", 2],
      ["offer", 1],
    ]);
    expect(f[1].conversion).toBe(0.75);
    expect(f[3].conversion).toBe(0.5);

    const durations = A.stageDurations(ctx());
    expect(durations.find((d) => d.stage === "applied")).toMatchObject({ n: 4, avgDays: 4 });

    expect(A.resumePerformance(ctx())).toEqual([{ key: "CV v2", id: ids.resume, applications: 3, interviews: 2, rate: 2 / 3 }]);
  });

  it("groups rejections by reason and stage", () => {
    db.insert(s.opportunities).values([
      { companyId: ids.dream, title: "A", status: "rejected", rejectionReason: "Filled", rejectedAtStage: "screening" },
      { companyId: ids.dream, title: "B", status: "rejected", rejectionReason: "Filled", rejectedAtStage: "interviewing" },
      { companyId: ids.dream, title: "C", status: "rejected" },
    ]).run();
    expect(A.rejectionReasons(ctx())).toEqual([
      { key: "Filled", n: 2 },
      { key: "No reason given", n: 1 },
    ]);
    expect(A.rejectionStages(ctx()).map((r) => r.key).sort()).toEqual(["applied", "interviewing", "screening"]);
  });
});

describe("seed exclusion", () => {
  it("includes seed rows only while there is no real data", () => {
    send("cold_email", "email", NOW.getTime() - DAY, { isSeed: true });
    expect(A.shouldIncludeSeed(db)).toBe(true);
    send("cold_email", "email", NOW.getTime() - DAY);
    expect(A.shouldIncludeSeed(db)).toBe(false);
    expect(A.kpis(ctx(null, false)).current.outreach).toBe(1);
    expect(A.kpis(ctx(null, true)).current.outreach).toBe(2);
  });
});

describe("dashboard", () => {
  const goals = { application: 2, cold_email: 3 };
  const map = (entries: [string, Record<string, number>][]) => new Map(entries);

  it("evaluates goal modes", () => {
    expect(dayMeetsGoal({ application: 2 }, goals, "any_goal")).toBe(true);
    expect(dayMeetsGoal({ application: 2 }, goals, "all_goals")).toBe(false);
    expect(dayMeetsGoal({ note: 1 }, goals, "any_activity")).toBe(true);
    expect(dayMeetsGoal(undefined, goals, "any_activity")).toBe(false);
  });

  it("reports today's progress on each streak target", () => {
    expect(streakTargets({ cold_email: 2 }, goals, "any_goal")).toEqual([
      { type: "application", count: 0, goal: 2 },
      { type: "cold_email", count: 2, goal: 3 },
    ]);
    expect(streakTargets({ cold_email: 2 }, goals, "any_activity")).toEqual([]);
  });

  it("keeps the streak alive until today is over", () => {
    const days = map([
      ["2026-09-20", { application: 2 }],
      ["2026-09-21", { application: 3 }],
      ["2026-09-22", { cold_email: 3 }],
      ["2026-09-23", { cold_email: 4 }],
    ]);
    expect(computeStreaks(days, "2026-09-24", goals, "any_goal")).toMatchObject({ current: 4, longest: 4, todayMet: false });
    days.set("2026-09-24", { application: 2 });
    expect(computeStreaks(days, "2026-09-24", goals, "any_goal").current).toBe(5);
    expect(computeStreaks(days, "2026-09-26", goals, "any_goal")).toMatchObject({ current: 0, longest: 5 });
  });

  it("groups follow-ups into overdue, today and this week", () => {
    const due = (h: number) =>
      db.insert(s.activities).values({ type: "cold_email", direction: "outbound", companyId: ids.dream, occurredAt: new Date(NOW.getTime() - 6 * DAY), followUpDueAt: new Date(NOW.getTime() + h * HOUR) }).run();
    due(-30); // overdue (yesterday)
    due(2); // today (14:00 → 16:00 Tunis)
    due(48); // this week
    const g = groupFollowUps(followUpsDue(db, new Date(NOW.getTime() + 8 * DAY)), NOW, TZ);
    expect([g.overdue.length, g.today.length, g.week.length]).toEqual([1, 1, 1]);
  });
});

describe("weekly review", () => {
  it("summarizes a local week", () => {
    const { from, to } = weekBounds("2026-09-21", TZ);
    expect(from.toISOString()).toBe("2026-09-20T23:00:00.000Z");
    expect(to.getTime() - from.getTime()).toBe(7 * DAY);
    const t = new Date("2026-09-22T08:00:00Z").getTime();
    send("cold_email", "email", t, { replyAfterHours: 3 });
    send("cold_email", "email", t);
    send("cold_email", "email", t);
    send("linkedin_dm", "linkedin", t);
    const settings = db.select().from(s.settings).get()!;
    const r = getWeeklyReview(db, settings, "2026-09-21");
    expect(r).toMatchObject({ outreach: 4, repliedThreads: 1, total: 4 });
    expect(r.bestChannel).toMatchObject({ channel: "email", sent: 3, replied: 1 });
    expect(r.replies).toHaveLength(1);
    expect(r.goals.find((g) => g.type === "cold_email")).toMatchObject({ actual: 3, hit: false });
  });
});

describe("JSON backup", () => {
  it("round-trips every table", () => {
    send("cold_email", "email", NOW.getTime(), { replyAfterHours: 1 });
    const backup = validateBackup(JSON.parse(JSON.stringify(exportBackup(db))));
    const other = testDb();
    const counts = importBackup(other, backup);
    expect(counts.activities).toBe(2);
    expect(counts.companies).toBe(2);
    expect(other.$client.prepare("select count(*) n from search_index where kind = 'company'").get()).toEqual({ n: 2 });
    expect(() => validateBackup({ app: "other" })).toThrow();
  });
});
