"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CalendarClock, CalendarDays, Hourglass, Inbox, Minus, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/detail/parts";
import { ActivityIcon } from "@/components/shared/status-badge";
import { RelativeTime } from "@/components/shared/relative-time";
import { LinkedInIcon } from "@/components/brand/icons";
import { usePrefs } from "@/components/providers/prefs";
import { ActivityHeatmap } from "@/components/dashboard/heatmap";
import { FollowUpList } from "@/components/dashboard/follow-up-list";
import { TodayGoals } from "@/components/dashboard/today-goals";
import { ACTIVE_STATUSES, TERMINAL_STATUSES, type ActivityType, type DailyGoals, type InterviewStage, type OpportunityStatus } from "@/lib/domain";
import { ACTIVITY_META, INTERVIEW_STAGE_META, STATUS_META } from "@/lib/meta";
import { formatTz, relativeShort } from "@/lib/dates";
import { opt, type LayoutItem } from "@/lib/dashboard-layout";
import type { DashboardData } from "@/lib/services/dashboard";
import type { NoteListItem } from "@/lib/queries/records";
import { cn } from "@/lib/utils";

/** Everything the widgets need, fetched once on the server for the widest options. */
export type WidgetData = {
  d: DashboardData;
  pipeline: Record<OpportunityStatus, number>;
  notes: NoteListItem[];
  weeklyGoals: DailyGoals;
  now: number;
};

const DAY = 86_400_000;

/**
 * Renders one widget from its options. Client-side so that changing an
 * option while customizing previews instantly, before anything is saved.
 */
export function DashboardWidget({ item, data }: { item: LayoutItem; data: WidgetData }) {
  const Widget = WIDGETS[item.id];
  return <Widget item={item} data={data} />;
}

type Props = { item: LayoutItem; data: WidgetData };

const WIDGETS: Record<LayoutItem["id"], (props: Props) => React.ReactNode> = {
  today: Today,
  week: Week,
  followUps: FollowUps,
  upcoming: Upcoming,
  heatmap: Heatmap,
  recent: Recent,
  pipeline: Pipeline,
  notes: PinnedNotes,
};

const PanelLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href as "/"} className="text-xs text-muted-foreground hover:text-foreground">
    {children}
  </Link>
);

function Quiet({ icon: Icon, children }: { icon: typeof Inbox; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} />
      {children}
    </div>
  );
}

function Today({ item, data: { d } }: Props) {
  const shown = new Set(opt.list(item.options, "types"));
  const goals = Object.fromEntries(Object.entries(d.goals).filter(([t]) => shown.has(t))) as DailyGoals;
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[0.8125rem] font-medium">{item.title ?? "Today"}</h3>
        <PanelLink href="/settings">Edit goals</PanelLink>
      </div>
      <TodayGoals counts={d.todayCounts} goals={goals} showExtra={opt.bool(item.options, "extra")} only={shown} />
    </section>
  );
}

function Week({ item, data: { d } }: Props) {
  const compare = opt.bool(item.options, "compare");
  const stats = opt.list(item.options, "stats");
  const cells: Record<string, React.ReactNode> = {
    outreach: <Stat key="outreach" label="Outreach this week" value={d.week.outreach} previous={d.week.outreachPrev} compare={compare} />,
    replies: <Stat key="replies" label="Replies this week" value={d.week.replies} previous={d.week.repliesPrev} compare={compare} />,
    applications: (
      <Stat key="applications" label="Applications" value={d.week.counts.application ?? 0} previous={d.week.lastWeekSameSpan.application ?? 0} compare={compare} />
    ),
    linkedin: (
      <div key="linkedin" className="flex flex-col gap-1 px-4 py-4 md:px-5">
        <span className="flex items-center gap-1.5 text-[0.78125rem] text-muted-foreground">
          <LinkedInIcon className="size-3.5" />
          Connections this week
        </span>
        <span className="tabular text-[1.75rem] leading-none font-semibold tracking-[-0.03em]">
          {d.linkedin.sent}
          <span className="text-base font-normal text-muted-foreground">/{d.linkedin.limit}</span>
        </span>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={d.linkedin.sent} aria-valuemax={d.linkedin.limit} aria-label="LinkedIn weekly limit">
          <div
            className={cn("h-full rounded-full", d.linkedin.sent / d.linkedin.limit > 0.85 ? "bg-status-rejected" : "bg-act-linkedin_connection")}
            style={{ width: `${Math.min(100, (d.linkedin.sent / d.linkedin.limit) * 100)}%` }}
          />
        </div>
      </div>
    ),
  };
  const shown = stats.map((s) => cells[s]).filter(Boolean);
  return (
    <section aria-label={item.title ?? "This week"} className="flex flex-col overflow-hidden rounded-xl border bg-card">
      {item.title && <h3 className="border-b px-4 py-3 text-[0.8125rem] font-medium">{item.title}</h3>}
      {shown.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">Pick at least one number in this block&apos;s settings.</p>
      ) : (
        <div
          className={cn(
            // 1px gaps over a border-colored background draw the dividers.
            "grid flex-1 grid-cols-2 gap-px bg-border [&>*]:bg-card",
            // Two per row on narrow cards (a lone last cell spans both), all in one row when there's room.
            "[&>*:last-child:nth-child(odd)]:col-span-2 @2xl:[&>*:last-child:nth-child(odd)]:col-span-1",
            shown.length === 1 && "grid-cols-1",
            shown.length === 3 && "@2xl:grid-cols-3",
            shown.length === 4 && "@2xl:grid-cols-4",
          )}
        >
          {shown}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, previous, compare }: { label: string; value: number; previous: number; compare: boolean }) {
  const change = previous === 0 ? (value > 0 ? 100 : 0) : Math.round(((value - previous) / previous) * 100);
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  return (
    <div className="flex flex-col gap-1 px-4 py-4 md:px-5">
      <span className="text-[0.78125rem] text-muted-foreground">{label}</span>
      <span className="tabular text-[1.75rem] leading-none font-semibold tracking-[-0.03em]">{value}</span>
      {compare && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Compared with the same days last week">
          <span className={cn("tabular inline-flex items-center font-medium", change > 0 && "text-status-accepted", change < 0 && "text-status-rejected")}>
            <Icon className="size-3.5" strokeWidth={2.25} />
            {Math.abs(change)}%
          </span>
          vs last week
        </span>
      )}
    </div>
  );
}

function FollowUps({ item, data: { d, now } }: Props) {
  const range = opt.str(item.options, "range");
  const limit = opt.num(item.options, "limit");
  const due = [...d.followUps.overdue, ...d.followUps.today];
  const items = range === "week" ? [...due, ...d.followUps.week] : due;
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          {item.title ?? "Follow-ups"}
          {due.length > 0 && <span className="tabular rounded-full bg-brand-soft px-1.5 text-[0.6875rem] text-brand">{due.length} due</span>}
        </span>
      }
      action={<PanelLink href="/follow-ups">All follow-ups</PanelLink>}
      bodyClassName="p-0"
    >
      {items.length ? (
        <>
          <FollowUpList items={items.slice(0, limit)} now={now} compact />
          {items.length > limit && (
            <Link href="/follow-ups" className="block border-t px-4 py-2.5 text-center text-xs text-muted-foreground hover:text-foreground">
              {items.length - limit} more
            </Link>
          )}
        </>
      ) : (
        <Quiet icon={Inbox}>
          <p className="text-sm font-medium">Nothing due {range === "week" ? "this week" : "today"}</p>
          <p className="text-xs text-muted-foreground">
            {range === "due" && d.followUps.week.length ? `${d.followUps.week.length} coming up this week.` : "Reminders appear here when outreach goes unanswered."}
          </p>
        </Quiet>
      )}
    </Panel>
  );
}

function Upcoming({ item, data: { d, now } }: Props) {
  const { timezone: tz } = usePrefs();
  const days = opt.num(item.options, "days");
  const show = new Set(opt.list(item.options, "show"));
  const until = now + days * DAY;
  const upcoming = [
    ...(show.has("interviews") ? d.interviews.map((i) => ({ kind: "interview" as const, at: i.scheduledAt, ...i })) : []),
    ...(show.has("deadlines") ? d.deadlines.map((x) => ({ kind: "deadline" as const, at: x.deadline, ...x })) : []),
  ]
    .filter((u) => u.at < until)
    .sort((a, b) => a.at - b.at);
  const what = show.size === 1 ? (show.has("interviews") ? "interviews" : "deadlines") : "interviews or deadlines";

  return (
    <Panel
      title={item.title ?? (days === 30 ? "Next 30 days" : days === 14 ? "Next 2 weeks" : `Next ${days} days`)}
      action={
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" asChild>
          <a href="/api/calendar" download>
            <CalendarDays data-icon="inline-start" />
            .ics
          </a>
        </Button>
      }
      bodyClassName="p-0"
    >
      {upcoming.length === 0 ? (
        <Quiet icon={CalendarClock}>
          <p className="text-sm text-muted-foreground">No {what} coming up.</p>
        </Quiet>
      ) : (
        <ol className="divide-y">
          {upcoming.map((u) => (
            <li key={`${u.kind}-${u.id}`}>
              <Link href={`/opportunities/${u.kind === "interview" ? u.opportunityId : u.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                <div className="flex w-10 shrink-0 flex-col items-center rounded-md border py-1 leading-none">
                  <span className="text-[0.625rem] font-medium text-muted-foreground uppercase">{formatTz(u.at, tz, "EEE")}</span>
                  <span className="tabular mt-0.5 text-base font-semibold">{formatTz(u.at, tz, "d")}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.84375rem] font-medium">{u.companyName}</p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    {u.kind === "interview" ? (
                      <>
                        <CalendarClock className="size-3.5 shrink-0" />
                        {INTERVIEW_STAGE_META[u.stage as InterviewStage].label} · {formatTz(u.at, tz, "HH:mm")} · {u.durationMinutes}m
                      </>
                    ) : (
                      <>
                        <Hourglass className="size-3.5 shrink-0" />
                        Deadline · {u.title}
                      </>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function Heatmap({ item, data: { d, weeklyGoals } }: Props) {
  const months = opt.num(item.options, "months");
  // The data starts on a week boundary, so whole weeks can be taken off the front.
  const weeks = Math.round((months * 365) / 12 / 7);
  const days = d.heatmap.slice(Math.max(0, d.heatmap.length - (weeks - 1) * 7 - (d.heatmap.length % 7 || 7)));
  const targets = opt.bool(item.options, "targets")
    ? (Object.entries(weeklyGoals).filter(([, g]) => (g ?? 0) > 0) as [ActivityType, number][])
    : [];
  return (
    <section className="rounded-xl border bg-card p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[0.8125rem] font-medium">{item.title ?? (months === 12 ? "Last 12 months" : `Last ${months} months`)}</h3>
        {targets.length > 0 && (
          <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            This week:
            {targets.map(([t, g]) => (
              <span key={t} className={cn("tabular", (d.week.counts[t] ?? 0) >= g && "text-status-accepted")}>
                {ACTIVITY_META[t].short} {d.week.counts[t] ?? 0}/{g}
              </span>
            ))}
          </p>
        )}
      </div>
      <ActivityHeatmap days={days} />
    </section>
  );
}

function Recent({ item, data: { d, now } }: Props) {
  const { timezone: tz } = usePrefs();
  const directions = new Set(opt.list(item.options, "direction"));
  const rows = d.recent.filter((a) => directions.has(a.direction)).slice(0, opt.num(item.options, "limit"));
  return (
    <Panel title={item.title ?? "Recent activity"} action={<PanelLink href="/activities">View all</PanelLink>} bodyClassName="p-0">
      {rows.length === 0 ? (
        <Quiet icon={Inbox}>
          <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
        </Quiet>
      ) : (
        <ol className="divide-y">
          {rows.map((a) => {
            const who = a.contactName ?? a.opportunityTitle;
            const href = a.opportunityId ? `/opportunities/${a.opportunityId}` : a.companyId ? `/companies/${a.companyId}` : "/activities";
            return (
              <li key={a.id}>
                <Link href={href as "/"} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                  <ActivityIcon type={a.type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.84375rem]">
                      <span className="font-medium">{a.direction === "inbound" ? "Reply received" : ACTIVITY_META[a.type].label}</span>
                      {who && <span className="text-muted-foreground"> · {who}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{a.companyName}</p>
                  </div>
                  <time dateTime={new Date(a.occurredAt).toISOString()} className="tabular shrink-0 text-xs text-muted-foreground" title={formatTz(a.occurredAt, tz, "PPpp")}>
                    {relativeShort(a.occurredAt, now, tz)}
                  </time>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

function Pipeline({ item, data: { pipeline } }: Props) {
  const total = ACTIVE_STATUSES.reduce((n, s) => n + pipeline[s], 0);
  return (
    <Panel title={item.title ?? "Pipeline"} action={<PanelLink href="/pipeline">Open board</PanelLink>}>
      {opt.bool(item.options, "bar") && (
        <div className="mb-4 flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Opportunities by stage">
          {total > 0 &&
            ACTIVE_STATUSES.filter((s) => pipeline[s] > 0).map((s) => (
              <div key={s} className="h-full" style={{ width: `${(pipeline[s] / total) * 100}%`, backgroundColor: STATUS_META[s].color }} />
            ))}
        </div>
      )}
      <ul className="space-y-2">
        {ACTIVE_STATUSES.map((s) => (
          <li key={s} className="flex items-center justify-between text-[0.8125rem]">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2 rounded-[3px]" style={{ backgroundColor: STATUS_META[s].color }} />
              {STATUS_META[s].label}
            </span>
            <span className="tabular font-medium">{pipeline[s]}</span>
          </li>
        ))}
        {opt.bool(item.options, "closed") && (
          <li className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
            <span>Closed</span>
            <span className="tabular">{TERMINAL_STATUSES.map((s) => `${pipeline[s]} ${STATUS_META[s].label.toLowerCase()}`).join(" · ")}</span>
          </li>
        )}
      </ul>
    </Panel>
  );
}

function PinnedNotes({ item, data: { notes, now } }: Props) {
  const preview = opt.bool(item.options, "preview");
  const shown = notes.slice(0, opt.num(item.options, "limit"));
  return (
    <Panel title={item.title ?? "Pinned notes"} action={<PanelLink href="/notes">All notes</PanelLink>} bodyClassName="p-0">
      {shown.length === 0 ? (
        <Quiet icon={Pin}>
          <p className="text-sm text-muted-foreground">Pin a note on the Notes page to keep it here.</p>
        </Quiet>
      ) : (
        <ul className="divide-y">
          {shown.map((n) => (
            <li key={n.id}>
              <Link href={`/notes/${n.id}`} className="block px-4 py-2.5 hover:bg-muted/50">
                <p className="flex items-center justify-between gap-2">
                  <span className="truncate text-[0.84375rem] font-medium">{n.title || "Untitled"}</span>
                  <RelativeTime value={n.updatedAt} now={now} className="shrink-0 text-xs text-muted-foreground" />
                </p>
                {preview && n.preview && <p className="line-clamp-2 text-xs text-muted-foreground">{n.preview}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
