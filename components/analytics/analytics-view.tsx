"use client";

import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AnalyticsData } from "@/lib/services/analytics";
import { ACTIVITY_GROUPS, groupOf } from "@/lib/chart-groups";
import { CHANNEL_META, SOURCE_META, STATUS_META, TIER_META, ACTIVITY_META } from "@/lib/meta";
import type { ActivityType, Channel, OpportunitySource, OpportunityStatus, Tier } from "@/lib/domain";
import { MIN_SAMPLE, formatDuration, pct } from "@/lib/analytics-constants";
import { cn } from "@/lib/utils";
import { ChartCard } from "./chart-card";
import { BarList, type BarRow } from "./bars";
import { PerDayChart } from "./per-day-chart";
import { Funnel } from "./funnel";
import { SendHeatmap } from "./send-heatmap";

type RateRow = { key: string; sent: number; replied: number; rate: number };

const rateRows = (rows: RateRow[], label: (k: string) => string): BarRow[] =>
  rows.map((r) => ({
    key: r.key,
    label: label(r.key),
    value: r.rate,
    display: pct(r.rate),
    detail: `${r.replied}/${r.sent}`,
    n: r.sent,
    tooltip: `${label(r.key)}: ${r.replied} of ${r.sent} threads got a reply (${pct(r.rate)})`,
  }));

const rateTable = (rows: RateRow[], label: (k: string) => string, first: string) => ({
  columns: [first, "Sent", "Replied", "Reply rate"],
  rows: rows.map((r) => [label(r.key), r.sent, r.replied, pct(r.rate)]),
});

const sum = (rows: { sent: number }[]) => rows.reduce((a, r) => a + r.sent, 0);

export function AnalyticsView({ data, weekStartsOn }: { data: AnalyticsData; weekStartsOn: number }) {
  const { kpis } = data;

  // Group the ten activity types into five series; bucket by week on long ranges.
  const perDay = useMemo(() => {
    const byDay = data.perDay.map((d) => {
      const row: Record<string, number | string> = { day: d.day };
      for (const g of ACTIVITY_GROUPS) row[g.key] = 0;
      for (const [k, v] of Object.entries(d)) {
        if (k === "day" || typeof v !== "number") continue;
        const g = groupOf(k as ActivityType);
        row[g] = (row[g] as number) + v;
      }
      return row;
    });
    if (byDay.length <= 120) return byDay;
    const weeks: Record<string, number | string>[] = [];
    byDay.forEach((d, i) => {
      if (i % 7 === 0) weeks.push({ ...d });
      else for (const g of ACTIVITY_GROUPS) weeks[weeks.length - 1][g.key] = (weeks[weeks.length - 1][g.key] as number) + (d[g.key] as number);
    });
    return weeks;
  }, [data.perDay]);
  const totalActivities = perDay.reduce((a, d) => a + ACTIVITY_GROUPS.reduce((s, g) => s + (d[g.key] as number), 0), 0);

  const channelLabel = (k: string) => CHANNEL_META[k as Channel]?.label ?? k;
  const sourceLabel = (k: string) => SOURCE_META[k as OpportunitySource]?.label ?? "Unknown";
  const tierLabel = (k: string) => TIER_META[k as Tier]?.label ?? k;
  const identity = (k: string) => k;

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4 [&>*]:border-border max-lg:[&>*:nth-child(-n+2)]:border-b max-lg:[&>*:nth-child(odd)]:border-r lg:[&>*:not(:last-child)]:border-r">
        <Kpi label="Outreach" info="New outbound threads: messages with no parent. Follow-ups don't count." value={kpis.current.outreach} prev={kpis.previous?.outreach} />
        <Kpi
          label="Reply rate"
          info="Threads with at least one reply ÷ outreach threads, counted by the date of the original send."
          value={kpis.current.replyRate}
          prev={kpis.previous?.replyRate}
          format={pct}
          sample={kpis.current.outreach}
          sub={`${kpis.current.replies} of ${kpis.current.outreach}`}
        />
        <Kpi label="Interviews" info="Interviews scheduled in this range (cancelled excluded)." value={kpis.current.interviews} prev={kpis.previous?.interviews} />
        <Kpi label="Offers" info="Opportunities that reached Offer in this range." value={kpis.current.offers} prev={kpis.previous?.offers} />
      </section>

      <ChartCard
        title="Activity per day"
        info="Everything you sent, by local day, stacked by type. Replies are not included. Long ranges group by week."
        empty={totalActivities === 0}
        table={{
          columns: ["Day", ...ACTIVITY_GROUPS.map((g) => g.label)],
          rows: perDay.map((d) => [String(d.day), ...ACTIVITY_GROUPS.map((g) => d[g.key] as number)]),
        }}
      >
        <PerDayChart data={perDay as ({ day: string } & Record<string, number>)[]} />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Reply rate by channel"
          info="Share of outreach threads (by channel of the first message) that got at least one reply."
          sample={sum(data.byChannel)}
          empty={!data.byChannel.length}
          table={rateTable(data.byChannel, channelLabel, "Channel")}
        >
          <BarList rows={rateRows(data.byChannel, channelLabel)} max={1} />
        </ChartCard>
        <ChartCard
          title="Reply rate by source"
          info="Threads linked to an opportunity, grouped by where you found the role."
          sample={sum(data.bySource)}
          empty={!data.bySource.length}
          table={rateTable(data.bySource, sourceLabel, "Source")}
        >
          <BarList rows={rateRows(data.bySource, sourceLabel)} max={1} />
        </ChartCard>
        <ChartCard
          title="Reply rate by tier"
          info="Do dream companies answer less? Threads grouped by the company's tier."
          sample={sum(data.byTier)}
          empty={!data.byTier.length}
          table={rateTable(data.byTier, tierLabel, "Tier")}
        >
          <BarList rows={rateRows(data.byTier, tierLabel)} max={1} labelWidth="w-20" />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Funnel"
          info="Opportunities that ever reached each stage (from status history, not current status), for roles first applied to in this range. Skipping a stage counts as passing it."
          sample={data.funnel[0]?.count}
          empty={!data.funnel[0]?.count}
          table={{
            columns: ["Stage", "Reached", "Conversion"],
            rows: data.funnel.map((f) => [STATUS_META[f.stage].label, f.count, f.conversion === null ? "—" : pct(f.conversion)]),
          }}
        >
          <Funnel steps={data.funnel} />
        </ChartCard>
        <ChartCard
          title="Best time to send"
          info="Reply rate by the weekday and hour your first message went out, in your timezone. Hollow cells have a single send."
          sample={sum(data.heatmap)}
          empty={!data.heatmap.length}
          table={{
            columns: ["Day", "Hour", "Sent", "Replied", "Rate"],
            rows: [...data.heatmap]
              .sort((a, b) => a.dow - b.dow || a.hour - b.hour)
              .map((c) => [["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][c.dow], `${c.hour}:00`, c.sent, c.replied, pct(c.replied / c.sent)]),
          }}
        >
          <SendHeatmap cells={data.heatmap} weekStartsOn={weekStartsOn} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Time to first reply"
          info="Average time from the original message to the first reply, per channel. Only threads that got a reply count."
          sample={data.timeToReply.reduce((a, r) => a + r.n, 0)}
          empty={!data.timeToReply.length}
          table={{
            columns: ["Channel", "Replies", "Average", "Fastest", "Slowest"],
            rows: data.timeToReply.map((r) => [channelLabel(r.key), r.n, formatDuration(r.avgHours), formatDuration(r.minHours), formatDuration(r.maxHours)]),
          }}
        >
          <BarList
            color="var(--chart-1)"
            rows={data.timeToReply.map((r) => ({
              key: r.key,
              label: channelLabel(r.key),
              value: r.avgHours,
              display: formatDuration(r.avgHours),
              detail: `n=${r.n}`,
              n: r.n,
              tooltip: `${channelLabel(r.key)}: avg ${formatDuration(r.avgHours)} (fastest ${formatDuration(r.minHours)}, slowest ${formatDuration(r.maxHours)})`,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Days in each stage"
          info="Average time between consecutive status changes, grouped by the stage the role was sitting in."
          sample={data.stageDurations.reduce((a, r) => a + r.n, 0)}
          empty={!data.stageDurations.length}
          table={{ columns: ["Stage", "Transitions", "Avg days"], rows: data.stageDurations.map((r) => [STATUS_META[r.stage].label, r.n, r.avgDays.toFixed(1)]) }}
        >
          <BarList
            rows={data.stageDurations.map((r) => ({
              key: r.stage,
              label: STATUS_META[r.stage].label,
              value: r.avgDays,
              display: `${r.avgDays.toFixed(1)}d`,
              detail: `n=${r.n}`,
              n: r.n,
              color: STATUS_META[r.stage].color,
            }))}
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Templates"
          info="Each templated send (first message or follow-up) counts as replied if its thread got a reply afterwards."
          sample={sum(data.templates)}
          empty={!data.templates.length}
          table={rateTable(data.templates, identity, "Template")}
        >
          <BarList rows={rateRows(data.templates, identity)} max={1} labelWidth="w-40" />
        </ChartCard>
        <ChartCard
          title="Resume versions"
          info="Applications sent with each resume, and the share that reached Interviewing or beyond."
          sample={data.resumes.reduce((a, r) => a + r.applications, 0)}
          empty={!data.resumes.length}
          table={{ columns: ["Resume", "Applications", "Interviews", "Interview rate"], rows: data.resumes.map((r) => [r.key, r.applications, r.interviews, pct(r.rate)]) }}
        >
          <BarList
            labelWidth="w-40"
            max={1}
            rows={data.resumes.map((r) => ({
              key: String(r.id),
              label: r.key,
              value: r.rate,
              display: pct(r.rate),
              detail: `${r.interviews}/${r.applications}`,
              n: r.applications,
              tooltip: `${r.key}: ${r.interviews} of ${r.applications} applications reached interviews`,
            }))}
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Industries that reply"
          info="Industries ranked by replies received, with their reply rate."
          sample={sum(data.industries)}
          empty={!data.industries.length}
          table={rateTable(data.industries, identity, "Industry")}
        >
          <BarList rows={rateRows(data.industries, identity)} max={1} />
        </ChartCard>
        <ChartCard
          title="Tech stacks that reply"
          info="Technologies in company stacks, ranked by replies to outreach at those companies."
          sample={sum(data.techStacks)}
          empty={!data.techStacks.length}
          table={rateTable(data.techStacks, identity, "Stack")}
        >
          <BarList rows={rateRows(data.techStacks, identity)} max={1} labelWidth="w-24" />
        </ChartCard>
        <ChartCard
          title="By country"
          info="Reply rate by the company's country."
          sample={sum(data.byCountry)}
          empty={!data.byCountry.length}
          table={rateTable(data.byCountry, identity, "Country")}
        >
          <BarList rows={rateRows(data.byCountry, identity)} max={1} labelWidth="w-28" />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Rejection reasons"
          info="Why roles closed as Rejected (rejections in this range)."
          sample={data.rejectionReasons.reduce((a, r) => a + r.n, 0)}
          empty={!data.rejectionReasons.length}
          table={{ columns: ["Reason", "Count"], rows: data.rejectionReasons.map((r) => [r.key, r.n]) }}
        >
          <BarList
            color="var(--status-rejected)"
            labelWidth="w-48"
            rows={data.rejectionReasons.map((r) => ({ key: r.key, label: r.key, value: r.n, display: String(r.n) }))}
          />
        </ChartCard>
        <ChartCard
          title="Where rejections happen"
          info="The stage an opportunity was in when it was rejected."
          sample={data.rejectionStages.reduce((a, r) => a + r.n, 0)}
          empty={!data.rejectionStages.length}
          table={{ columns: ["Stage", "Rejections"], rows: data.rejectionStages.map((r) => [STATUS_META[r.key].label, r.n]) }}
        >
          <BarList
            rows={[...data.rejectionStages]
              .sort((a, b) => (["wishlist", "applied", "screening", "interviewing", "offer"] as OpportunityStatus[]).indexOf(a.key) - (["wishlist", "applied", "screening", "interviewing", "offer"] as OpportunityStatus[]).indexOf(b.key))
              .map((r) => ({ key: r.key, label: STATUS_META[r.key].label, value: r.n, display: String(r.n), color: STATUS_META[r.key].color }))}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Reply rate by activity type"
        info="How each kind of first message performs."
        sample={sum(data.byType)}
        empty={!data.byType.length}
        table={rateTable(data.byType, (k) => ACTIVITY_META[k as ActivityType].label, "Type")}
      >
        <BarList
          labelWidth="w-36"
          max={1}
          rows={rateRows(data.byType, (k) => ACTIVITY_META[k as ActivityType].label).map((r) => ({ ...r, color: ACTIVITY_META[r.key as ActivityType].color }))}
        />
      </ChartCard>
    </div>
  );
}

function Kpi({
  label,
  info,
  value,
  prev,
  format = (n: number) => n.toLocaleString(),
  sample,
  sub,
}: {
  label: string;
  info: string;
  value: number;
  prev?: number | null;
  format?: (n: number) => string;
  sample?: number;
  sub?: string;
}) {
  const hasPrev = prev !== undefined && prev !== null;
  const change = hasPrev ? (prev === 0 ? (value > 0 ? 1 : 0) : (value - prev) / prev) : 0;
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  return (
    <div className="flex flex-col gap-1 px-4 py-4 md:px-5">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="w-fit cursor-help text-[12.5px] text-muted-foreground decoration-dotted underline-offset-4 hover:underline">{label}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-xs">{info}</TooltipContent>
      </Tooltip>
      <span className="text-[28px] leading-none font-semibold tracking-[-0.03em]">{format(value)}</span>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        {hasPrev ? (
          <span className="inline-flex items-center gap-1">
            <span className={cn("tabular inline-flex items-center font-medium", change > 0 && "text-status-accepted", change < 0 && "text-status-rejected")}>
              <Icon className="size-3.5" strokeWidth={2.25} />
              {Math.abs(Math.round(change * 100))}%
            </span>
            vs previous
          </span>
        ) : (
          <span>all time</span>
        )}
        {sub && <span>· {sub}</span>}
        {sample !== undefined && sample > 0 && sample < MIN_SAMPLE && <span className="text-status-withdrawn">· small sample</span>}
      </span>
    </div>
  );
}
