import type { DB } from "@/db/client";
import type { Settings } from "@/db/schema";
import { ACTIVITY_TYPES, type ActivityType, type Channel, type OpportunityStatus } from "@/lib/domain";
import { fromZonedTime } from "date-fns-tz";
import { countsByDay, dayMeetsGoal } from "./dashboard";

const DAY = 86_400_000;

/** UTC bounds of the local week that starts on `weekStart` (yyyy-MM-dd). */
export function weekBounds(weekStart: string, tz: string) {
  const from = fromZonedTime(`${weekStart}T00:00:00`, tz);
  const end = new Date(`${weekStart}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 7);
  const to = fromZonedTime(`${end.toISOString().slice(0, 10)}T00:00:00`, tz);
  return { from, to };
}

export function getWeeklyReview(db: DB, settings: Settings, weekStart: string) {
  const tz = settings.timezone;
  const { from, to } = weekBounds(weekStart, tz);
  const params = { from: from.getTime(), to: to.getTime() };

  const byType = db.$client
    .prepare(
      `select type, count(*) as n from activities
       where direction = 'outbound' and deleted_at is null and occurred_at >= @from and occurred_at < @to
       group by 1`,
    )
    .all(params) as { type: ActivityType; n: number }[];
  const counts: Partial<Record<ActivityType, number>> = {};
  for (const r of byType) counts[r.type] = r.n;

  const channels = db.$client
    .prepare(
      `select r.channel, count(*) as sent,
         sum(exists(select 1 from activities c where c.parent_activity_id = r.id and c.direction = 'inbound' and c.deleted_at is null)) as replied
       from activities r
       where r.direction = 'outbound' and r.parent_activity_id is null and r.deleted_at is null
         and r.type not in ('interview','note') and r.occurred_at >= @from and r.occurred_at < @to
       group by 1 order by sent desc`,
    )
    .all(params) as { channel: Channel; sent: number; replied: number }[];

  const outreach = channels.reduce((n, c) => n + c.sent, 0);
  const repliedThreads = channels.reduce((n, c) => n + c.replied, 0);
  // Best channel: highest reply rate among channels with at least 3 sends, else most replies.
  const eligible = channels.filter((c) => c.sent >= 3);
  const best =
    (eligible.length ? eligible : channels)
      .map((c) => ({ ...c, rate: c.sent ? c.replied / c.sent : 0 }))
      .sort((a, b) => b.rate - a.rate || b.replied - a.replied)[0] ?? null;

  const replies = db.$client
    .prepare(
      `select a.id, a.type, a.summary, a.occurred_at as occurredAt, c.id as companyId, c.name as companyName, p.name as contactName
       from activities a left join companies c on c.id = a.company_id left join contacts p on p.id = a.contact_id
       where a.direction = 'inbound' and a.deleted_at is null and a.occurred_at >= @from and a.occurred_at < @to
       order by a.occurred_at`,
    )
    .all(params) as {
    id: number;
    type: ActivityType;
    summary: string | null;
    occurredAt: number;
    companyId: number | null;
    companyName: string | null;
    contactName: string | null;
  }[];

  const stageChanges = db.$client
    .prepare(
      `select h.id, h.from_status as fromStatus, h.to_status as toStatus, h.changed_at as changedAt,
         o.id as opportunityId, o.title, c.name as companyName
       from status_history h join opportunities o on o.id = h.opportunity_id join companies c on c.id = o.company_id
       where h.changed_at >= @from and h.changed_at < @to and h.from_status is not null and o.deleted_at is null
       order by h.changed_at`,
    )
    .all(params) as {
    id: number;
    fromStatus: OpportunityStatus;
    toStatus: OpportunityStatus;
    changedAt: number;
    opportunityId: number;
    title: string;
    companyName: string;
  }[];

  const interviews = db.$client
    .prepare(
      `select count(*) as n from interviews where deleted_at is null and outcome != 'cancelled'
       and scheduled_at >= @from and scheduled_at < @to`,
    )
    .get(params) as { n: number };

  const goals = ACTIVITY_TYPES.filter((t) => (settings.weeklyGoals[t] ?? 0) > 0).map((type) => ({
    type,
    goal: settings.weeklyGoals[type]!,
    actual: counts[type] ?? 0,
    hit: (counts[type] ?? 0) >= settings.weeklyGoals[type]!,
  }));

  const daily = countsByDay(db, tz, from);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${weekStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const c = daily.get(key);
    return {
      day: key,
      total: c ? Object.values(c).reduce((a, b) => a + (b ?? 0), 0) : 0,
      met: dayMeetsGoal(c, settings.dailyGoals, settings.streakMode),
    };
  });

  const notes = db.$client
    .prepare("select notes from weekly_reviews where week_start = ? and deleted_at is null")
    .get(weekStart) as { notes: string | null } | undefined;

  return {
    weekStart,
    from,
    to,
    counts,
    total: Object.values(counts).reduce((a, b) => a + (b ?? 0), 0),
    outreach,
    repliedThreads,
    replies,
    channels,
    bestChannel: best,
    stageChanges,
    interviews: interviews.n,
    goals,
    days,
    notes: notes?.notes ?? "",
  };
}
export type WeeklyReviewData = ReturnType<typeof getWeeklyReview>;

export function shiftWeek(weekStart: string, weeks: number) {
  const d = new Date(`${weekStart}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export { DAY };
