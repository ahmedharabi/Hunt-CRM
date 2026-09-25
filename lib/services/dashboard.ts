import type { DB } from "@/db/client";
import type { Settings } from "@/db/schema";
import { ACTIVITY_TYPES, type ActivityType, type DailyGoals, type StreakMode } from "@/lib/domain";
import { dayKey, startOfDayTz, startOfWeekTz } from "@/lib/dates";

const DAY = 86_400_000;

type Counts = Partial<Record<ActivityType, number>>;

/** Outbound activity counts per local day and type since `since`. */
export function countsByDay(db: DB, tz: string, since: Date): Map<string, Counts> {
  const rows = db.$client
    .prepare(
      `select local_day(occurred_at, @tz) as day, type, count(*) as n
       from activities
       where direction = 'outbound' and deleted_at is null and occurred_at >= @since
       group by 1, 2`,
    )
    .all({ tz, since: since.getTime() }) as { day: string; type: ActivityType; n: number }[];
  const map = new Map<string, Counts>();
  for (const r of rows) {
    const entry = map.get(r.day) ?? {};
    entry[r.type] = r.n;
    map.set(r.day, entry);
  }
  return map;
}

export function total(counts: Counts | undefined) {
  if (!counts) return 0;
  return Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
}

/** Whether a day counts toward the streak under the configured mode. */
export function dayMeetsGoal(counts: Counts | undefined, goals: DailyGoals, mode: StreakMode) {
  const goalEntries = Object.entries(goals).filter(([, g]) => (g ?? 0) > 0) as [ActivityType, number][];
  if (mode === "any_activity" || goalEntries.length === 0) return total(counts) > 0;
  const met = goalEntries.map(([type, goal]) => (counts?.[type] ?? 0) >= goal);
  return mode === "all_goals" ? met.every(Boolean) : met.some(Boolean);
}

function shiftDay(day: string, delta: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Current streak counts back from today — or from yesterday if today's
 * goal isn't met *yet*, so the streak doesn't look broken at 9am.
 */
export function computeStreaks(byDay: Map<string, Counts>, today: string, goals: DailyGoals, mode: StreakMode) {
  const met = (d: string) => dayMeetsGoal(byDay.get(d), goals, mode);

  let current = 0;
  let cursor = met(today) ? today : shiftDay(today, -1);
  while (met(cursor)) {
    current++;
    cursor = shiftDay(cursor, -1);
  }

  const days = [...byDay.keys()].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    if (!met(d)) {
      run = 0;
      prev = d;
      continue;
    }
    run = prev && shiftDay(prev, 1) === d && run > 0 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest: Math.max(longest, current), todayMet: met(today) };
}

export type FollowUpItem = {
  id: number;
  type: ActivityType;
  channel: string;
  subject: string | null;
  occurredAt: number;
  followUpDueAt: number;
  parentActivityId: number | null;
  companyId: number | null;
  companyName: string | null;
  companyTier: string | null;
  contactId: number | null;
  contactName: string | null;
  opportunityId: number | null;
  opportunityTitle: string | null;
  followUps: number;
};

/** Pending follow-ups due before `until`, oldest due first. */
export function followUpsDue(db: DB, until: Date): FollowUpItem[] {
  return db.$client
    .prepare(
      `select a.id, a.type, a.channel, a.subject, a.occurred_at as occurredAt, a.follow_up_due_at as followUpDueAt,
         a.parent_activity_id as parentActivityId,
         c.id as companyId, c.name as companyName, c.tier as companyTier,
         p.id as contactId, p.name as contactName,
         o.id as opportunityId, o.title as opportunityTitle,
         (select count(*) from activities f where f.parent_activity_id = coalesce(a.parent_activity_id, a.id)
            and f.type = 'follow_up' and f.deleted_at is null) as followUps
       from activities a
       left join companies c on c.id = a.company_id
       left join contacts p on p.id = a.contact_id
       left join opportunities o on o.id = a.opportunity_id
       where a.deleted_at is null and a.follow_up_due_at is not null and a.outcome = 'pending'
         and a.follow_up_due_at < @until
       order by a.follow_up_due_at asc`,
    )
    .all({ until: until.getTime() }) as FollowUpItem[];
}

export function groupFollowUps(items: FollowUpItem[], now: Date, tz: string) {
  const startToday = startOfDayTz(now, tz).getTime();
  const endToday = startToday + DAY;
  return {
    overdue: items.filter((i) => i.followUpDueAt < startToday),
    today: items.filter((i) => i.followUpDueAt >= startToday && i.followUpDueAt < endToday),
    week: items.filter((i) => i.followUpDueAt >= endToday),
  };
}

export function getDashboard(db: DB, settings: Settings, now = new Date()) {
  const tz = settings.timezone;
  const today = dayKey(now, tz);
  const startToday = startOfDayTz(now, tz);
  const weekStart = startOfWeekTz(now, tz, settings.weekStartsOn);
  const lastWeekStart = new Date(weekStart.getTime() - 7 * DAY);

  // ~6 months for the heatmap, plus a year of history for the longest streak.
  const byDay = countsByDay(db, tz, new Date(now.getTime() - 400 * DAY));
  const todayCounts = byDay.get(today) ?? {};
  const streak = computeStreaks(byDay, today, settings.dailyGoals, settings.streakMode);

  const heatmapStart = startOfWeekTz(new Date(now.getTime() - 26 * 7 * DAY), tz, settings.weekStartsOn);
  const heatmap: { day: string; count: number; met: boolean }[] = [];
  for (let d = dayKey(heatmapStart, tz); d <= today; d = shiftDay(d, 1)) {
    heatmap.push({
      day: d,
      count: total(byDay.get(d)),
      met: dayMeetsGoal(byDay.get(d), settings.dailyGoals, settings.streakMode),
    });
  }

  const sumRange = (from: Date, to: Date) => {
    const fromKey = dayKey(from, tz);
    const toKey = dayKey(new Date(to.getTime() - 1), tz);
    const out: Counts = {};
    for (const [d, counts] of byDay) {
      if (d < fromKey || d > toKey) continue;
      for (const t of ACTIVITY_TYPES) if (counts[t]) out[t] = (out[t] ?? 0) + counts[t]!;
    }
    return out;
  };
  // Compare the same number of elapsed days: this week so far vs last week's first N days.
  const elapsed = now.getTime() - weekStart.getTime();
  const thisWeek = sumRange(weekStart, new Date(startToday.getTime() + DAY));
  const lastWeekSameSpan = sumRange(lastWeekStart, new Date(lastWeekStart.getTime() + elapsed));
  const lastWeekFull = sumRange(lastWeekStart, weekStart);

  const threads = (from: Date, to: Date) =>
    db.$client
      .prepare(
        `select count(*) as sent, sum(exists(select 1 from activities c where c.parent_activity_id = r.id
            and c.direction = 'inbound' and c.deleted_at is null)) as replied
         from activities r
         where r.direction = 'outbound' and r.parent_activity_id is null and r.deleted_at is null
           and r.type not in ('interview','note') and r.occurred_at >= @from and r.occurred_at < @to`,
      )
      .get({ from: from.getTime(), to: to.getTime() }) as { sent: number; replied: number | null };

  const repliesReceived = (from: Date, to: Date) =>
    (
      db.$client
        .prepare(
          `select count(*) as n from activities where direction = 'inbound' and deleted_at is null
           and occurred_at >= @from and occurred_at < @to`,
        )
        .get({ from: from.getTime(), to: to.getTime() }) as { n: number }
    ).n;

  const followUps = groupFollowUps(followUpsDue(db, new Date(startToday.getTime() + 8 * DAY)), now, tz);

  const in7 = now.getTime() + 7 * DAY;
  const interviews = db.$client
    .prepare(
      `select i.id, i.stage, i.scheduled_at as scheduledAt, i.duration_minutes as durationMinutes,
         o.id as opportunityId, o.title, c.id as companyId, c.name as companyName, c.timezone as companyTz
       from interviews i join opportunities o on o.id = i.opportunity_id join companies c on c.id = o.company_id
       where i.deleted_at is null and i.outcome != 'cancelled' and i.scheduled_at >= @now and i.scheduled_at < @in7
       order by i.scheduled_at`,
    )
    .all({ now: now.getTime() - 2 * 3_600_000, in7 }) as {
    id: number;
    stage: string;
    scheduledAt: number;
    durationMinutes: number;
    opportunityId: number;
    title: string;
    companyId: number;
    companyName: string;
    companyTz: string | null;
  }[];

  const deadlines = db.$client
    .prepare(
      `select o.id, o.title, o.deadline, o.status, c.id as companyId, c.name as companyName
       from opportunities o join companies c on c.id = o.company_id
       where o.deleted_at is null and o.deadline >= @start and o.deadline < @in7
         and o.status in ('wishlist', 'applied', 'screening', 'interviewing', 'offer')
       order by o.deadline`,
    )
    .all({ start: startToday.getTime(), in7 }) as {
    id: number;
    title: string;
    deadline: number;
    status: string;
    companyId: number;
    companyName: string;
  }[];

  const recent = db.$client
    .prepare(
      `select a.id, a.type, a.direction, a.subject, a.summary, a.occurred_at as occurredAt, a.outcome,
         c.id as companyId, c.name as companyName, p.id as contactId, p.name as contactName,
         o.id as opportunityId, o.title as opportunityTitle
       from activities a
       left join companies c on c.id = a.company_id
       left join contacts p on p.id = a.contact_id
       left join opportunities o on o.id = a.opportunity_id
       where a.deleted_at is null
       order by a.occurred_at desc limit 12`,
    )
    .all() as {
    id: number;
    type: ActivityType;
    direction: "inbound" | "outbound";
    subject: string | null;
    summary: string | null;
    occurredAt: number;
    outcome: string;
    companyId: number | null;
    companyName: string | null;
    contactId: number | null;
    contactName: string | null;
    opportunityId: number | null;
    opportunityTitle: string | null;
  }[];

  const tw = threads(weekStart, now);
  const lw = threads(lastWeekStart, new Date(lastWeekStart.getTime() + elapsed));

  return {
    today,
    todayCounts,
    goals: settings.dailyGoals,
    weeklyGoals: settings.weeklyGoals,
    streak,
    heatmap,
    week: {
      counts: thisWeek,
      lastWeekSameSpan,
      lastWeekFull,
      outreach: tw.sent,
      outreachPrev: lw.sent,
      replies: repliesReceived(weekStart, now),
      repliesPrev: repliesReceived(lastWeekStart, new Date(lastWeekStart.getTime() + elapsed)),
    },
    linkedin: {
      sent: thisWeek.linkedin_connection ?? 0,
      limit: settings.linkedinWeeklyConnectionLimit,
    },
    followUps,
    interviews,
    deadlines,
    recent,
  };
}
export type DashboardData = ReturnType<typeof getDashboard>;
