"use client";

import { usePrefs } from "@/components/providers/prefs";
import { formatTz } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * GitHub-style contribution grid: columns are weeks, rows are weekdays
 * (starting on the configured first day). Intensity uses the brand color;
 * days that met the goal get a small dot.
 */
export function ActivityHeatmap({ days }: { days: { day: string; count: number; met: boolean }[] }) {
  const { timezone, weekStartsOn } = usePrefs();
  const max = Math.max(4, ...days.map((d) => d.count));
  const level = (n: number) => (n === 0 ? 0 : n <= max * 0.25 ? 1 : n <= max * 0.5 ? 2 : n <= max * 0.75 ? 3 : 4);
  const weeks: (typeof days)[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const rowLabels = Array.from({ length: 7 }, (_, i) => labels[(weekStartsOn + i) % 7]);
  const toDate = (d: string) => new Date(`${d}T12:00:00Z`);
  const total = days.reduce((a, d) => a + d.count, 0);
  const activeDays = days.filter((d) => d.count > 0).length;

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <div className="grid shrink-0 grid-rows-7 gap-[3px] pt-5 text-[10px] text-muted-foreground">
          {rowLabels.map((l, i) => (
            <span key={l} className={cn("h-[11px] leading-[11px]", i % 2 === 1 && "invisible")}>
              {l}
            </span>
          ))}
        </div>
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => {
            const first = week[0];
            const showMonth = wi === 0 || first.day.slice(5, 7) !== weeks[wi - 1][0].day.slice(5, 7);
            return (
              <div key={first.day} className="flex flex-col gap-[3px]">
                <span className="h-4 text-[10px] whitespace-nowrap text-muted-foreground">{showMonth ? formatTz(toDate(first.day), "UTC", "MMM") : ""}</span>
                {week.map((d) => (
                  <span
                    key={d.day}
                    title={`${d.count} ${d.count === 1 ? "activity" : "activities"} · ${formatTz(toDate(d.day), "UTC", "EEE, MMM d")}${d.met ? " · goal met" : ""}`}
                    className={cn(
                      "relative size-[11px] rounded-[3px]",
                      level(d.count) === 0 && "bg-muted",
                      level(d.count) === 1 && "bg-brand/25",
                      level(d.count) === 2 && "bg-brand/45",
                      level(d.count) === 3 && "bg-brand/70",
                      level(d.count) === 4 && "bg-brand",
                    )}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular">
          {total} activities on {activeDays} days
          <span className="sr-only"> in {timezone}</span>
        </span>
        <span className="flex items-center gap-1">
          Less
          {["bg-muted", "bg-brand/25", "bg-brand/45", "bg-brand/70", "bg-brand"].map((c) => (
            <span key={c} className={cn("size-[11px] rounded-[3px]", c)} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
