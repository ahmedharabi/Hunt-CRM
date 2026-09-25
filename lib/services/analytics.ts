import type { DB } from "@/db/client";
import { ACTIVE_STATUSES, type ActivityType, type Channel, type OpportunityStatus, type Tier } from "@/lib/domain";

/*
 * Metric definitions (from the spec — keep these exact):
 *
 *  Outreach           outbound activities with no parent (follow-ups are not new
 *                     outreach). Interviews and notes are records, not outreach,
 *                     so they're excluded.
 *  Reply rate         threads with ≥1 inbound reply / outreach threads, where the
 *                     thread's ORIGINAL send falls in the date range.
 *  Time to first reply  first inbound child − original send, per thread.
 *  Funnel conversion  opportunities that ever reached stage N+1 / that ever
 *                     reached stage N, read from status_history. "Reached" means
 *                     reached that stage or a later one, so a jump from Applied
 *                     straight to Interviewing still counts as passing Screening.
 *  Stage duration     time between consecutive status_history entries.
 *
 * Seed rows are excluded as soon as any real (non-seed) activity exists.
 * Every result carries its sample size so the UI can flag n < 5.
 */

export { MIN_SAMPLE } from "@/lib/analytics-constants";

export type Range = { from: Date | null; to: Date };
export type Ctx = { db: DB; tz: string; range: Range; includeSeed: boolean };

type Params = Record<string, string | number | null>;

function q<T>(ctx: Ctx, sql: string, extra: Params = {}): T[] {
  return ctx.db.$client.prepare(sql).all({
    from: ctx.range.from?.getTime() ?? 0,
    to: ctx.range.to.getTime(),
    tz: ctx.tz,
    ...extra,
  }) as T[];
}

const seed = (ctx: Ctx, alias: string) => (ctx.includeSeed ? "1" : `${alias}.is_seed = 0`);

/** True when there's real data, in which case seed rows are excluded. */
export function shouldIncludeSeed(db: DB) {
  const row = db.$client
    .prepare("select exists(select 1 from activities where is_seed = 0 and deleted_at is null) as real")
    .get() as { real: number };
  return row.real === 0;
}

const threadsCte = (ctx: Ctx) => `
  threads as (
    select r.id, r.type, r.channel, r.company_id, r.opportunity_id, r.template_id, r.occurred_at,
      (select min(c.occurred_at) from activities c
        where c.parent_activity_id = r.id and c.direction = 'inbound' and c.deleted_at is null) as first_reply_at
    from activities r
    where r.direction = 'outbound' and r.parent_activity_id is null and r.deleted_at is null
      and r.type not in ('interview', 'note')
      and r.occurred_at >= :from and r.occurred_at < :to
      and ${seed(ctx, "r")}
  )`;

export type RateRow<K extends string = string> = { key: K; sent: number; replied: number; rate: number };

function withRate<R extends { sent: number; replied: number }>(rows: R[]): (R & { rate: number })[] {
  return rows.map((r) => ({ ...r, rate: r.sent ? r.replied / r.sent : 0 }));
}

/* ─────────────────────────── KPIs ─────────────────────────── */

export type Kpis = {
  outreach: number;
  replies: number;
  replyRate: number;
  interviews: number;
  offers: number;
};

function kpisFor(ctx: Ctx): Kpis {
  const [t] = q<{ outreach: number; replies: number }>(
    ctx,
    `with ${threadsCte(ctx)}
     select count(*) as outreach, count(first_reply_at) as replies from threads`,
  );
  const [i] = q<{ n: number }>(
    ctx,
    `select count(*) as n from interviews i
     where i.deleted_at is null and i.outcome != 'cancelled'
       and i.scheduled_at >= :from and i.scheduled_at < :to and ${seed(ctx, "i")}`,
  );
  const [o] = q<{ n: number }>(
    ctx,
    `select count(distinct h.opportunity_id) as n from status_history h
     where h.to_status = 'offer' and h.changed_at >= :from and h.changed_at < :to and ${seed(ctx, "h")}`,
  );
  return {
    outreach: t.outreach,
    replies: t.replies,
    replyRate: t.outreach ? t.replies / t.outreach : 0,
    interviews: i.n,
    offers: o.n,
  };
}

/** KPIs for the range, plus the same metrics for the preceding period of equal length. */
export function kpis(ctx: Ctx): { current: Kpis; previous: Kpis | null } {
  const current = kpisFor(ctx);
  if (!ctx.range.from) return { current, previous: null };
  const span = ctx.range.to.getTime() - ctx.range.from.getTime();
  const previous = kpisFor({
    ...ctx,
    range: { from: new Date(ctx.range.from.getTime() - span), to: ctx.range.from },
  });
  return { current, previous };
}

/* ─────────────────────────── volume ─────────────────────────── */

export function activitiesPerDay(ctx: Ctx) {
  const rows = q<{ day: string; type: ActivityType; n: number }>(
    ctx,
    `select local_day(a.occurred_at, :tz) as day, a.type, count(*) as n
     from activities a
     where a.direction = 'outbound' and a.deleted_at is null
       and a.occurred_at >= :from and a.occurred_at < :to and ${seed(ctx, "a")}
     group by 1, 2 order by 1`,
  );
  const byDay = new Map<string, Partial<Record<ActivityType, number>>>();
  for (const r of rows) {
    const entry = byDay.get(r.day) ?? {};
    entry[r.type] = r.n;
    byDay.set(r.day, entry);
  }
  // Fill gaps so the x-axis is continuous.
  const days = [...byDay.keys()].sort();
  if (!days.length) return [];
  const start = ctx.range.from ? localDay(ctx.range.from, ctx.tz) : days[0];
  const end = localDay(ctx.range.to, ctx.tz);
  const out: ({ day: string } & Partial<Record<ActivityType, number>>)[] = [];
  for (let d = start; d <= end; d = nextDay(d)) out.push({ day: d, ...byDay.get(d) });
  return out;
}

function localDay(date: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function nextDay(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/* ─────────────────────────── response rates ─────────────────────────── */

export function replyRateByChannel(ctx: Ctx) {
  return withRate(
    q<{ key: Channel; sent: number; replied: number }>(
      ctx,
      `with ${threadsCte(ctx)}
       select channel as key, count(*) as sent, count(first_reply_at) as replied
       from threads group by 1 order by sent desc`,
    ),
  );
}

export function replyRateByType(ctx: Ctx) {
  return withRate(
    q<{ key: ActivityType; sent: number; replied: number }>(
      ctx,
      `with ${threadsCte(ctx)}
       select type as key, count(*) as sent, count(first_reply_at) as replied
       from threads group by 1 order by sent desc`,
    ),
  );
}

export function replyRateBySource(ctx: Ctx) {
  return withRate(
    q<{ key: string; sent: number; replied: number }>(
      ctx,
      `with ${threadsCte(ctx)}
       select coalesce(o.source, 'unknown') as key, count(*) as sent, count(t.first_reply_at) as replied
       from threads t join opportunities o on o.id = t.opportunity_id
       group by 1 order by sent desc`,
    ),
  );
}

export function replyRateByTier(ctx: Ctx) {
  return withRate(
    q<{ key: Tier; sent: number; replied: number }>(
      ctx,
      `with ${threadsCte(ctx)}
       select c.tier as key, count(*) as sent, count(t.first_reply_at) as replied
       from threads t join companies c on c.id = t.company_id
       group by 1 order by case c.tier when 'dream' then 0 when 'target' then 1 else 2 end`,
    ),
  );
}

export function replyRateByCountry(ctx: Ctx) {
  return withRate(
    q<{ key: string; sent: number; replied: number }>(
      ctx,
      `with ${threadsCte(ctx)}
       select coalesce(c.country, 'Unknown') as key, count(*) as sent, count(t.first_reply_at) as replied
       from threads t join companies c on c.id = t.company_id
       group by 1 order by sent desc limit 12`,
    ),
  );
}

export function topIndustries(ctx: Ctx) {
  return withRate(
    q<{ key: string; sent: number; replied: number }>(
      ctx,
      `with ${threadsCte(ctx)}
       select coalesce(c.industry, 'Unknown') as key, count(*) as sent, count(t.first_reply_at) as replied
       from threads t join companies c on c.id = t.company_id
       group by 1 having replied > 0 order by replied desc, sent asc limit 8`,
    ),
  );
}

export function topTechStacks(ctx: Ctx) {
  return withRate(
    q<{ key: string; sent: number; replied: number }>(
      ctx,
      `with ${threadsCte(ctx)}
       select j.value as key, count(*) as sent, count(t.first_reply_at) as replied
       from threads t join companies c on c.id = t.company_id, json_each(c.tech_stack) j
       group by 1 having replied > 0 order by replied desc, sent asc limit 10`,
    ),
  );
}

/* ─────────────────────────── timing ─────────────────────────── */

export function timeToFirstReply(ctx: Ctx) {
  return q<{ key: Channel; n: number; avgHours: number; minHours: number; maxHours: number }>(
    ctx,
    `with ${threadsCte(ctx)}
     select channel as key, count(*) as n,
       avg(first_reply_at - occurred_at) / 3600000.0 as avgHours,
       min(first_reply_at - occurred_at) / 3600000.0 as minHours,
       max(first_reply_at - occurred_at) / 3600000.0 as maxHours
     from threads where first_reply_at is not null
     group by 1 order by n desc`,
  );
}

/** Reply rate by weekday × hour the original message was sent (local time). */
export function sendTimeHeatmap(ctx: Ctx) {
  return q<{ dow: number; hour: number; sent: number; replied: number }>(
    ctx,
    `with ${threadsCte(ctx)}
     select local_dow(occurred_at, :tz) as dow, local_hour(occurred_at, :tz) as hour,
       count(*) as sent, count(first_reply_at) as replied
     from threads group by 1, 2`,
  );
}

/* ─────────────────────────── pipeline ─────────────────────────── */

const STAGE_RANK = `case h.to_status
  when 'applied' then 1 when 'screening' then 2 when 'interviewing' then 3
  when 'offer' then 4 when 'accepted' then 5 else 0 end`;

/** Opportunities whose first Applied entry falls in the range, and how far each got. */
export function funnel(ctx: Ctx) {
  const stages = ["applied", "screening", "interviewing", "offer"] as const;
  const [row] = q<Record<string, number>>(
    ctx,
    `with reached as (
       select h.opportunity_id, max(${STAGE_RANK}) as rank,
         min(case when h.to_status = 'applied' then h.changed_at end) as applied_at
       from status_history h join opportunities o on o.id = h.opportunity_id
       where o.deleted_at is null and ${seed(ctx, "o")}
       group by 1
     )
     select
       sum(rank >= 1) as applied, sum(rank >= 2) as screening,
       sum(rank >= 3) as interviewing, sum(rank >= 4) as offer
     from reached where rank >= 1 and applied_at >= :from and applied_at < :to`,
  );
  return stages.map((stage, i) => {
    const count = row?.[stage] ?? 0;
    const prev = i === 0 ? null : (row?.[stages[i - 1]] ?? 0);
    return {
      stage: stage as OpportunityStatus,
      count,
      conversion: prev === null ? null : prev ? count / prev : 0,
      sampleSize: prev ?? count,
    };
  });
}

export function stageDurations(ctx: Ctx) {
  const rows = q<{ stage: OpportunityStatus; n: number; avgDays: number }>(
    ctx,
    `with ordered as (
       select h.opportunity_id, h.to_status as stage, h.changed_at,
         lead(h.changed_at) over (partition by h.opportunity_id order by h.changed_at, h.id) as next_at
       from status_history h join opportunities o on o.id = h.opportunity_id
       where o.deleted_at is null and ${seed(ctx, "o")}
     )
     select stage, count(*) as n, avg(next_at - changed_at) / 86400000.0 as avgDays
     from ordered
     where next_at is not null and changed_at >= :from and changed_at < :to
     group by 1`,
  );
  const order = ACTIVE_STATUSES as readonly string[];
  return rows.filter((r) => order.includes(r.stage)).sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage));
}

export function rejectionReasons(ctx: Ctx) {
  return q<{ key: string; n: number }>(
    ctx,
    `select coalesce(nullif(trim(o.rejection_reason), ''), 'No reason given') as key, count(*) as n
     from opportunities o
     where o.status = 'rejected' and o.deleted_at is null and ${seed(ctx, "o")}
       and coalesce((select max(changed_at) from status_history h where h.opportunity_id = o.id and h.to_status = 'rejected'), o.updated_at) >= :from
     group by 1 order by n desc limit 8`,
  );
}

export function rejectionStages(ctx: Ctx) {
  return q<{ key: OpportunityStatus; n: number }>(
    ctx,
    `select coalesce(o.rejected_at_stage, 'applied') as key, count(*) as n
     from opportunities o
     where o.status = 'rejected' and o.deleted_at is null and ${seed(ctx, "o")}
       and coalesce((select max(changed_at) from status_history h where h.opportunity_id = o.id and h.to_status = 'rejected'), o.updated_at) >= :from
     group by 1`,
  );
}

/* ─────────────────────────── content ─────────────────────────── */

/**
 * Each templated send (outreach or follow-up) counts as replied if its
 * thread received an inbound reply after it went out.
 */
export function templatePerformance(ctx: Ctx) {
  return withRate(
    q<{ key: string; id: number; sent: number; replied: number }>(
      ctx,
      `select t.name as key, t.id, count(*) as sent,
         sum(exists(
           select 1 from activities c
           where c.parent_activity_id = coalesce(a.parent_activity_id, a.id)
             and c.direction = 'inbound' and c.deleted_at is null and c.occurred_at > a.occurred_at
         )) as replied
       from activities a join templates t on t.id = a.template_id
       where a.direction = 'outbound' and a.deleted_at is null
         and a.occurred_at >= :from and a.occurred_at < :to and ${seed(ctx, "a")}
       group by t.id order by sent desc`,
    ),
  );
}

export function resumePerformance(ctx: Ctx) {
  return q<{ key: string; id: number; applications: number; interviews: number; rate: number }>(
    ctx,
    `select r.name as key, r.id, count(*) as applications,
       sum(exists(select 1 from status_history h where h.opportunity_id = o.id
         and h.to_status in ('interviewing', 'offer', 'accepted'))) as interviews,
       1.0 * sum(exists(select 1 from status_history h where h.opportunity_id = o.id
         and h.to_status in ('interviewing', 'offer', 'accepted'))) / count(*) as rate
     from opportunities o join resume_versions r on r.id = o.resume_version_id
     where o.deleted_at is null and o.applied_at is not null
       and o.applied_at >= :from and o.applied_at < :to and ${seed(ctx, "o")}
     group by r.id order by applications desc`,
  );
}

export function getAnalytics(ctx: Ctx) {
  return {
    kpis: kpis(ctx),
    perDay: activitiesPerDay(ctx),
    byChannel: replyRateByChannel(ctx),
    byType: replyRateByType(ctx),
    bySource: replyRateBySource(ctx),
    byTier: replyRateByTier(ctx),
    byCountry: replyRateByCountry(ctx),
    funnel: funnel(ctx),
    timeToReply: timeToFirstReply(ctx),
    stageDurations: stageDurations(ctx),
    heatmap: sendTimeHeatmap(ctx),
    templates: templatePerformance(ctx),
    resumes: resumePerformance(ctx),
    industries: topIndustries(ctx),
    techStacks: topTechStacks(ctx),
    rejectionReasons: rejectionReasons(ctx),
    rejectionStages: rejectionStages(ctx),
  };
}
export type AnalyticsData = ReturnType<typeof getAnalytics>;
