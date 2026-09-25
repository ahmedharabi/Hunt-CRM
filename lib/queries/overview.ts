import "server-only";
import { and, desc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { activities, companies, interviews, opportunities } from "@/db/schema";
import { OPPORTUNITY_STATUSES, type OpportunityStatus } from "@/lib/domain";
import { startOfDayTz, startOfWeekTz } from "@/lib/dates";

/**
 * Phase-1 overview used by the dashboard shell. Phase 4 replaces this
 * with goals, streaks, the heatmap and the follow-up engine.
 */
export function getOverview(now: Date, tz: string, weekStartsOn: number) {
  const db = getDb();
  const weekStart = startOfWeekTz(now, tz, weekStartsOn);
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 86_400_000);
  const endOfToday = new Date(startOfDayTz(now, tz).getTime() + 86_400_000);

  const [{ companiesCount }] = db
    .select({ companiesCount: sql<number>`count(*)` })
    .from(companies)
    .where(isNull(companies.deletedAt))
    .all();

  const byStatus = db
    .select({ status: opportunities.status, n: sql<number>`count(*)` })
    .from(opportunities)
    .where(isNull(opportunities.deletedAt))
    .groupBy(opportunities.status)
    .all();
  const pipeline = Object.fromEntries(OPPORTUNITY_STATUSES.map((s) => [s, 0])) as Record<OpportunityStatus, number>;
  for (const row of byStatus) pipeline[row.status] = row.n;

  // Outreach = outbound activities that start a thread (no parent).
  const outreachBetween = (from: Date, to: Date) =>
    db
      .select({ n: sql<number>`count(*)` })
      .from(activities)
      .where(
        and(
          isNull(activities.deletedAt),
          eq(activities.direction, "outbound"),
          isNull(activities.parentActivityId),
          sql`${activities.type} not in ('interview','note')`,
          gte(activities.occurredAt, from),
          lt(activities.occurredAt, to),
        ),
      )
      .get()!.n;

  const repliesBetween = (from: Date, to: Date) =>
    db
      .select({ n: sql<number>`count(*)` })
      .from(activities)
      .where(
        and(
          isNull(activities.deletedAt),
          eq(activities.direction, "inbound"),
          gte(activities.occurredAt, from),
          lt(activities.occurredAt, to),
        ),
      )
      .get()!.n;

  const followUpsDue = db
    .select({ n: sql<number>`count(*)` })
    .from(activities)
    .where(
      and(
        isNull(activities.deletedAt),
        eq(activities.outcome, "pending"),
        lte(activities.followUpDueAt, endOfToday),
      ),
    )
    .get()!.n;

  const recent = db.query.activities.findMany({
    where: isNull(activities.deletedAt),
    orderBy: desc(activities.occurredAt),
    limit: 9,
    with: {
      company: { columns: { id: true, name: true } },
      contact: { columns: { id: true, name: true } },
      opportunity: { columns: { id: true, title: true } },
    },
  }).sync();

  const upcoming = db
    .select({
      id: interviews.id,
      stage: interviews.stage,
      scheduledAt: interviews.scheduledAt,
      durationMinutes: interviews.durationMinutes,
      title: opportunities.title,
      company: companies.name,
    })
    .from(interviews)
    .innerJoin(opportunities, eq(interviews.opportunityId, opportunities.id))
    .innerJoin(companies, eq(opportunities.companyId, companies.id))
    .where(
      and(
        isNull(interviews.deletedAt),
        gte(interviews.scheduledAt, now),
        lt(interviews.scheduledAt, new Date(now.getTime() + 7 * 86_400_000)),
      ),
    )
    .orderBy(interviews.scheduledAt)
    .all();

  return {
    companiesCount,
    pipeline,
    outreach: { thisWeek: outreachBetween(weekStart, endOfToday), lastWeek: outreachBetween(lastWeekStart, weekStart) },
    replies: { thisWeek: repliesBetween(weekStart, endOfToday), lastWeek: repliesBetween(lastWeekStart, weekStart) },
    followUpsDue,
    recent,
    upcoming,
  };
}

export function getFollowUpsDueCount(now: Date, tz: string) {
  const endOfToday = new Date(startOfDayTz(now, tz).getTime() + 86_400_000);
  return getDb()
    .select({ n: sql<number>`count(*)` })
    .from(activities)
    .where(
      and(isNull(activities.deletedAt), eq(activities.outcome, "pending"), lte(activities.followUpDueAt, endOfToday)),
    )
    .get()!.n;
}
