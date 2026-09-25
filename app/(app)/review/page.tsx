import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Trophy, TriangleAlert } from "lucide-react";
import { Page } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { Panel, StatStrip } from "@/components/detail/parts";
import { StatusBadge, ActivityIcon } from "@/components/shared/status-badge";
import { NotesEditor } from "@/components/review/notes-editor";
import { getDb } from "@/db/client";
import { getWeeklyReview, shiftWeek } from "@/lib/services/review";
import { getSettings } from "@/lib/queries/settings";
import { dayKey, formatTz, startOfWeekTz } from "@/lib/dates";
import { ACTIVITY_META, CHANNEL_META } from "@/lib/meta";
import { pct } from "@/lib/analytics-constants";
import { cn } from "@/lib/utils";

export const metadata = { title: "Weekly review" };

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const sp = await searchParams;
  const settings = getSettings();
  const tz = settings.timezone;
  const now = new Date();
  const current = dayKey(startOfWeekTz(now, tz, settings.weekStartsOn), tz);
  const week = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : current;
  const r = getWeeklyReview(getDb(), settings, week);
  const isCurrent = week === current;

  const hit = r.goals.filter((g) => g.hit);
  const missed = r.goals.filter((g) => !g.hit);
  const advanced = r.stageChanges.filter((c) => !["rejected", "ghosted", "withdrawn"].includes(c.toStatus));
  const closed = r.stageChanges.filter((c) => ["rejected", "ghosted", "withdrawn"].includes(c.toStatus));
  const replyRate = r.outreach ? r.repliedThreads / r.outreach : 0;
  const label = `${formatTz(r.from, tz, "MMM d")} – ${formatTz(r.to.getTime() - 1, tz, "MMM d, yyyy")}`;

  // A short, plain-language summary built from the numbers.
  const summary: string[] = [];
  if (r.total === 0) summary.push(isCurrent ? "Nothing logged yet this week." : "A quiet week — nothing was logged.");
  else {
    summary.push(`You logged ${r.total} activit${r.total === 1 ? "y" : "ies"}, including ${r.outreach} new outreach thread${r.outreach === 1 ? "" : "s"}.`);
    if (r.outreach) summary.push(`${r.repliedThreads} of them got a reply (${pct(replyRate)}), and ${r.replies.length} repl${r.replies.length === 1 ? "y" : "ies"} came in overall.`);
    if (r.bestChannel && r.bestChannel.sent >= 3)
      summary.push(`${CHANNEL_META[r.bestChannel.channel].label} worked best at ${pct(r.bestChannel.replied / r.bestChannel.sent)}.`);
    if (advanced.length) summary.push(`${advanced.length} opportunit${advanced.length === 1 ? "y" : "ies"} moved forward.`);
    if (r.interviews) summary.push(`${r.interviews} interview${r.interviews === 1 ? "" : "s"} on the calendar.`);
    if (r.goals.length) summary.push(`Weekly goals: ${hit.length} of ${r.goals.length} hit.`);
  }

  return (
    <Page className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted-foreground">{isCurrent ? "This week" : "Week of"}</p>
          <h2 className="text-2xl font-semibold tracking-[-0.025em]">{label}</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon-sm" asChild aria-label="Previous week">
            <Link href={`/review?week=${shiftWeek(week, -1)}`}>
              <ChevronLeft />
            </Link>
          </Button>
          {!isCurrent && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/review">This week</Link>
            </Button>
          )}
          <Button variant="outline" size="icon-sm" asChild aria-label="Next week" disabled={isCurrent}>
            {isCurrent ? (
              <span aria-disabled className="pointer-events-none opacity-40">
                <ChevronRight />
              </span>
            ) : (
              <Link href={`/review?week=${shiftWeek(week, 1)}`}>
                <ChevronRight />
              </Link>
            )}
          </Button>
        </div>
      </div>

      <p className="rounded-xl border bg-card px-4 py-3.5 text-[14px] leading-relaxed text-foreground/90">{summary.join(" ")}</p>

      <StatStrip
        items={[
          { label: "Activities", value: r.total },
          { label: "New outreach", value: r.outreach },
          { label: "Reply rate", value: r.outreach ? pct(replyRate) : "—" },
          { label: "Interviews", value: r.interviews },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Goals">
          {r.goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No weekly goals set. <Link href="/settings" className="underline underline-offset-2">Add some in Settings.</Link>
            </p>
          ) : (
            <ul className="space-y-3">
              {r.goals.map((g) => (
                <li key={g.type} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2">
                      {g.hit ? <Trophy className="size-3.5 text-status-accepted" /> : <span className="size-3.5" />}
                      {ACTIVITY_META[g.type].label}
                    </span>
                    <span className="tabular">
                      <span className="font-medium">{g.actual}</span>
                      <span className="text-muted-foreground">/{g.goal}</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (g.actual / g.goal) * 100)}%`, backgroundColor: ACTIVITY_META[g.type].color }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 grid grid-cols-7 gap-1.5" aria-label="Daily goal by day">
            {r.days.map((d) => (
              <div key={d.day} className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase">{formatTz(new Date(`${d.day}T12:00:00Z`), "UTC", "EEE")}</p>
                <div
                  className={cn(
                    "tabular mt-1 flex h-9 items-center justify-center rounded-md border text-sm font-medium",
                    d.met ? "border-transparent bg-brand text-brand-foreground" : d.total ? "bg-muted/50" : "text-muted-foreground/60",
                  )}
                  title={d.met ? "Daily goal met" : undefined}
                >
                  {d.total}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Filled days met your daily goal ({settings.streakMode.replace("_", " ")}).</p>
        </Panel>

        <Panel title="By channel">
          {r.channels.length ? (
            <ul className="space-y-2.5">
              {r.channels.map((c) => (
                <li key={c.channel} className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2">
                    {CHANNEL_META[c.channel].label}
                    {r.bestChannel?.channel === c.channel && c.sent >= 3 && <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] text-brand">best</span>}
                  </span>
                  <span className="tabular text-muted-foreground">
                    {c.replied}/{c.sent} replied · <span className="font-medium text-foreground">{pct(c.sent ? c.replied / c.sent : 0)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No outreach this week.</p>
          )}
          {missed.length > 0 && r.total > 0 && (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-status-withdrawn/10 px-3 py-2 text-xs">
              <TriangleAlert className="mt-px size-3.5 shrink-0 text-status-withdrawn" />
              Missed: {missed.map((g) => `${ACTIVITY_META[g.type].label} (${g.actual}/${g.goal})`).join(", ")}
            </p>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={`Replies received · ${r.replies.length}`} bodyClassName="p-0">
          {r.replies.length ? (
            <ul className="divide-y">
              {r.replies.map((x) => (
                <li key={x.id} className="flex items-start gap-3 px-4 py-2.5">
                  <ActivityIcon type={x.type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px]">
                      <span className="font-medium">{x.contactName ?? x.companyName}</span>
                      {x.contactName && x.companyName && <span className="text-muted-foreground"> · {x.companyName}</span>}
                    </p>
                    {x.summary && <p className="line-clamp-2 text-xs text-muted-foreground">{x.summary}</p>}
                  </div>
                  <span className="tabular shrink-0 text-xs text-muted-foreground">{formatTz(x.occurredAt, tz, "EEE")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-muted-foreground">No replies this week.</p>
          )}
        </Panel>
        <Panel title={`Stage changes · ${r.stageChanges.length}`} bodyClassName="p-0">
          {r.stageChanges.length ? (
            <ul className="divide-y">
              {[...advanced, ...closed].map((c) => (
                <li key={c.id}>
                  <Link href={`/opportunities/${c.opportunityId}`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50">
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      <span className="font-medium">{c.companyName}</span>
                      <span className="text-muted-foreground"> · {c.title}</span>
                    </span>
                    <StatusBadge status={c.fromStatus} className="max-sm:hidden" />
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground max-sm:hidden" />
                    <StatusBadge status={c.toStatus} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-muted-foreground">No stage changes this week.</p>
          )}
        </Panel>
      </div>

      <Panel title="Reflection">
        <NotesEditor key={week} weekStart={week} initial={r.notes} />
      </Panel>
    </Page>
  );
}
