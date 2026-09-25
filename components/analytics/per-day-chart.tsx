"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ACTIVITY_GROUPS } from "@/lib/chart-groups";

const config = Object.fromEntries(ACTIVITY_GROUPS.map((g) => [g.key, { label: g.label, color: g.color }])) satisfies ChartConfig;

const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en", { ...opts, timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

/** Outbound activity per local day, stacked by activity group. Weekly buckets past ~120 days. */
export function PerDayChart({ data }: { data: ({ day: string } & Record<string, number | string>)[] }) {
  const barSize = data.length > 60 ? undefined : data.length > 30 ? 10 : 18;
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={data} margin={{ left: -18, right: 4, top: 8 }} barCategoryGap={data.length > 60 ? 1 : 2}>
        <CartesianGrid vertical={false} strokeWidth={1} />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(d: string) => fmtDay(d, { month: "short", day: "numeric" })}
        />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={<ChartTooltipContent labelFormatter={(d) => fmtDay(String(d), { weekday: "short", month: "short", day: "numeric" })} indicator="dot" />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        {ACTIVITY_GROUPS.map((g, i) => (
          <Bar
            key={g.key}
            dataKey={g.key}
            stackId="a"
            fill={`var(--color-${g.key})`}
            maxBarSize={24}
            barSize={barSize}
            stroke="var(--card)"
            strokeWidth={1}
            radius={i === ACTIVITY_GROUPS.length - 1 ? [4, 4, 0, 0] : 0}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
