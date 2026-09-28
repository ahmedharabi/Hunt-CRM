import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CalendarClock, CalendarDays, Hourglass, Inbox, Minus } from "lucide-react";
import { Page } from "@/components/shared/page";
import { ActivityIcon } from "@/components/shared/status-badge";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Kbd } from "@/components/ui/kbd";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";
import { LinkedInIcon } from "@/components/brand/icons";
import { Panel } from "@/components/detail/parts";
import { ActivityHeatmap } from "@/components/dashboard/heatmap";
import { FollowUpList } from "@/components/dashboard/follow-up-list";
import { StreakBadge, TodayGoals } from "@/components/dashboard/today-goals";
import { ACTIVE_STATUSES, TERMINAL_STATUSES, type OpportunityStatus } from "@/lib/domain";
import { ACTIVITY_META, INTERVIEW_STAGE_META, STATUS_META } from "@/lib/meta";
import { formatTz, greeting, relativeShort } from "@/lib/dates";
import { getDb } from "@/db/client";
import { getDashboard } from "@/lib/services/dashboard";
import { runGhosting } from "@/lib/services/automation";
import { getOverview } from "@/lib/queries/overview";
import { getSettings } from "@/lib/queries/settings";
import type { InterviewStage } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  const settings = getSettings();
  const tz = settings.timezone;
  const now = new Date();
  // Follow-up engine: close silent threads and ghost stale opportunities on load.
  const ghosted = runGhosting(getDb(), now, settings.ghostingThresholdDays);
  const d = getDashboard(getDb(), settings, now);
  const o = getOverview(now, tz, settings.weekStartsOn);

  if (o.companiesCount === 0 && d.recent.length === 0) return <FirstRun />;

  const dueNow = [...d.followUps.overdue, ...d.followUps.today];
  const nowMs = now.getTime();
  const weeklyTargets = Object.entries(settings.weeklyGoals).filter(([, g]) => (g ?? 0) > 0) as [keyof typeof ACTIVITY_META, number][];

  const upcoming = [
    ...d.interviews.map((i) => ({ kind: "interview" as const, at: i.scheduledAt, ...i })),
    ...d.deadlines.map((x) => ({ kind: "deadline" as const, at: x.deadline, ...x })),
  ].sort((a, b) => a.at - b.at);

  return (
    <Page className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.8125rem] text-muted-foreground">{formatTz(now, tz, "EEEE, MMMM d")}</p>
          <h2 className="mt-0.5 text-2xl font-semibold tracking-[-0.025em]">{greeting(now, tz)}</h2>
        </div>
        <StreakBadge {...d.streak} />
      </div>

      {(ghosted.threads > 0 || ghosted.opportunities > 0) && (
        <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Tidied up: {ghosted.threads > 0 && `${ghosted.threads} silent thread${ghosted.threads > 1 ? "s" : ""} marked no response`}
          {ghosted.threads > 0 && ghosted.opportunities > 0 && " · "}
          {ghosted.opportunities > 0 && `${ghosted.opportunities} opportunit${ghosted.opportunities > 1 ? "ies" : "y"} moved to Ghosted`} after{" "}
          {settings.ghostingThresholdDays} days of silence.
        </p>
      )}

      <section className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-[0.8125rem] font-medium">Today</h3>
          <Link href="/settings" className="text-xs text-muted-foreground hover:text-foreground">
            Edit goals
          </Link>
        </div>
        <TodayGoals counts={d.todayCounts} goals={d.goals} />
      </section>

      <section
        aria-label="This week"
        className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4 [&>*]:border-border max-lg:[&>*:nth-child(-n+2)]:border-b max-lg:[&>*:nth-child(odd)]:border-r lg:[&>*:not(:last-child)]:border-r"
      >
        <Stat label="Outreach this week" value={d.week.outreach} previous={d.week.outreachPrev} />
        <Stat label="Replies this week" value={d.week.replies} previous={d.week.repliesPrev} />
        <Stat label="Applications" value={d.week.counts.application ?? 0} previous={d.week.lastWeekSameSpan.application ?? 0} />
        <div className="flex flex-col gap-1 px-4 py-4 md:px-5">
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
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title={
            <span className="flex items-center gap-2">
              Follow-ups
              {dueNow.length > 0 && <span className="tabular rounded-full bg-brand-soft px-1.5 text-[0.6875rem] text-brand">{dueNow.length} due</span>}
            </span>
          }
          action={
            <Link href="/follow-ups" className="text-xs text-muted-foreground hover:text-foreground">
              All follow-ups
            </Link>
          }
          bodyClassName="p-0"
        >
          {dueNow.length ? (
            <>
              <FollowUpList items={dueNow.slice(0, 8)} now={nowMs} compact />
              {dueNow.length > 8 && (
                <Link href="/follow-ups" className="block border-t px-4 py-2.5 text-center text-xs text-muted-foreground hover:text-foreground">
                  {dueNow.length - 8} more due
                </Link>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Inbox className="size-5 text-muted-foreground" strokeWidth={1.75} />
              <p className="text-sm font-medium">Nothing due today</p>
              <p className="text-xs text-muted-foreground">
                {d.followUps.week.length ? `${d.followUps.week.length} coming up this week.` : "Reminders appear here when outreach goes unanswered."}
              </p>
            </div>
          )}
        </Panel>

        <Panel
          title="Next 7 days"
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
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <CalendarClock className="size-5 text-muted-foreground" strokeWidth={1.75} />
              <p className="text-sm text-muted-foreground">No interviews or deadlines this week.</p>
            </div>
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
      </div>

      <section className="rounded-xl border bg-card p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[0.8125rem] font-medium">Last 6 months</h3>
          {weeklyTargets.length > 0 && (
            <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              This week:
              {weeklyTargets.map(([t, g]) => (
                <span key={t} className={cn("tabular", (d.week.counts[t] ?? 0) >= g && "text-status-accepted")}>
                  {ACTIVITY_META[t].short} {d.week.counts[t] ?? 0}/{g}
                </span>
              ))}
            </p>
          )}
        </div>
        <ActivityHeatmap days={d.heatmap} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title="Recent activity"
          action={
            <Link href="/activities" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          }
          bodyClassName="p-0"
        >
          <ol className="divide-y">
            {d.recent.map((a) => {
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
        </Panel>
        <Pipeline pipeline={o.pipeline} />
      </div>
    </Page>
  );
}

function Stat({ label, value, previous }: { label: string; value: number; previous: number }) {
  const change = previous === 0 ? (value > 0 ? 100 : 0) : Math.round(((value - previous) / previous) * 100);
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  return (
    <div className="flex flex-col gap-1 px-4 py-4 md:px-5">
      <span className="text-[0.78125rem] text-muted-foreground">{label}</span>
      <span className="tabular text-[1.75rem] leading-none font-semibold tracking-[-0.03em]">{value}</span>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Compared with the same days last week">
        <span className={cn("tabular inline-flex items-center font-medium", change > 0 && "text-status-accepted", change < 0 && "text-status-rejected")}>
          <Icon className="size-3.5" strokeWidth={2.25} />
          {Math.abs(change)}%
        </span>
        vs last week
      </span>
    </div>
  );
}

function Pipeline({ pipeline }: { pipeline: Record<OpportunityStatus, number> }) {
  const total = ACTIVE_STATUSES.reduce((n, s) => n + pipeline[s], 0);
  return (
    <Panel
      title="Pipeline"
      action={
        <Link href="/pipeline" className="text-xs text-muted-foreground hover:text-foreground">
          Open board
        </Link>
      }
      className="self-start"
    >
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Opportunities by stage">
        {total > 0 &&
          ACTIVE_STATUSES.filter((s) => pipeline[s] > 0).map((s) => (
            <div key={s} className="h-full" style={{ width: `${(pipeline[s] / total) * 100}%`, backgroundColor: STATUS_META[s].color }} />
          ))}
      </div>
      <ul className="mt-4 space-y-2">
        {ACTIVE_STATUSES.map((s) => (
          <li key={s} className="flex items-center justify-between text-[0.8125rem]">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2 rounded-[3px]" style={{ backgroundColor: STATUS_META[s].color }} />
              {STATUS_META[s].label}
            </span>
            <span className="tabular font-medium">{pipeline[s]}</span>
          </li>
        ))}
        <li className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
          <span>Closed</span>
          <span className="tabular">{TERMINAL_STATUSES.map((s) => `${pipeline[s]} ${STATUS_META[s].label.toLowerCase()}`).join(" · ")}</span>
        </li>
      </ul>
    </Panel>
  );
}

function FirstRun() {
  return (
    <Page className="flex min-h-[70svh] items-center justify-center">
      <Empty className="max-w-md border-0">
        <EmptyHeader>
          <EmptyMedia>
            <LogoMark className="size-10" />
          </EmptyMedia>
          <EmptyTitle className="text-lg">Start your hunt</EmptyTitle>
          <EmptyDescription>
            Log every application, DM and follow-up in a few keystrokes. Hunt reminds you when to follow up and shows what&apos;s working.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="grid w-full gap-2 text-left text-sm">
            {[
              ["A", "Log an application"],
              ["E", "Log a cold email"],
              ["L", "Log a LinkedIn DM"],
              ["Ctrl K", "Search or run any command"],
            ].map(([k, label]) => (
              <div key={k} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="text-muted-foreground">{label}</span>
                <Kbd>{k}</Kbd>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Want to look around first? Run <code className="rounded bg-muted px-1.5 py-0.5 font-mono">npm run db:seed</code>
          </p>
        </EmptyContent>
      </Empty>
    </Page>
  );
}
