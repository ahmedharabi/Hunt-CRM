"use client";

import { Flame } from "lucide-react";
import { usePrefs } from "@/components/providers/prefs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ACTIVITY_TYPES } from "@/lib/domain";
import { ACTIVITY_META } from "@/lib/meta";
import { formatTz } from "@/lib/dates";
import type { HeatmapDay } from "@/lib/services/dashboard";
import { cn } from "@/lib/utils";

const LEVELS = ["bg-muted", "bg-brand/25", "bg-brand/45", "bg-brand/70", "bg-brand"];
const MAX_COMPANIES = 4;

const toDate = (d: string) => new Date(`${d}T12:00:00Z`);

/**
 * GitHub-style contribution grid: columns are weeks, rows are weekdays
 * (starting on the configured first day). Cells grow with the card up to
 * a cap and the grid sits centered; hovering a day shows what was logged.
 */
export function ActivityHeatmap({ days }: { days: HeatmapDay[] }) {
  const { timezone, weekStartsOn } = usePrefs();
  const max = Math.max(4, ...days.map((d) => d.count));
  const level = (n: number) => (n === 0 ? 0 : n <= max * 0.25 ? 1 : n <= max * 0.5 ? 2 : n <= max * 0.75 ? 3 : 4);
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const today = days.at(-1)?.day;

  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const rowLabels = Array.from({ length: 7 }, (_, i) => labels[(weekStartsOn + i) % 7]);
  const total = days.reduce((a, d) => a + d.count, 0);
  const activeDays = days.filter((d) => d.count > 0).length;

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div
          className="mx-auto grid w-fit min-w-full justify-center gap-[3px] sm:gap-1"
          style={{ gridTemplateColumns: `auto repeat(${weeks.length}, minmax(10px, 20px))`, gridTemplateRows: "auto repeat(7, auto)" }}
        >
          {rowLabels.map((l, i) => (
            <span
              key={l}
              style={{ gridColumn: 1, gridRow: i + 2 }}
              className={cn("self-center pr-1.5 text-[10px] leading-none text-muted-foreground", i % 2 === 1 && "invisible")}
            >
              {l}
            </span>
          ))}
          {weeks.map((week, wi) => {
            const first = week[0];
            const showMonth = wi === 0 ? Number(first.day.slice(8)) <= 21 : first.day.slice(5, 7) !== weeks[wi - 1][0].day.slice(5, 7);
            return [
              showMonth && (
                <span key={`m-${first.day}`} style={{ gridColumn: wi + 2, gridRow: 1 }} className="pb-1 text-[10px] whitespace-nowrap text-muted-foreground">
                  {formatTz(toDate(first.day), "UTC", "MMM")}
                </span>
              ),
              ...week.map((d, di) => (
                <Tooltip key={d.day}>
                  <TooltipTrigger asChild>
                    <span
                      role="img"
                      aria-label={summary(d)}
                      style={{ gridColumn: wi + 2, gridRow: di + 2 }}
                      className={cn(
                        "aspect-square w-full rounded-[3px] outline-offset-1 transition-[outline-color] hover:outline hover:outline-2 hover:outline-foreground/40",
                        LEVELS[level(d.count)],
                        d.day === today && "outline outline-1 outline-foreground/50",
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6} className="block max-w-64 px-3 py-2">
                    <DayDetails day={d} />
                  </TooltipContent>
                </Tooltip>
              )),
            ];
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular">
          {total} activities on {activeDays} days
          <span className="sr-only"> in {timezone}</span>
        </span>
        <span className="flex items-center gap-1">
          Less
          {LEVELS.map((c) => (
            <span key={c} className={cn("size-[11px] rounded-[3px]", c)} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}

function summary(d: HeatmapDay) {
  const date = formatTz(toDate(d.day), "UTC", "EEE, MMM d");
  return `${date}: ${d.count} ${d.count === 1 ? "activity" : "activities"}${d.met ? ", streak target hit" : ""}`;
}

function DayDetails({ day: d }: { day: HeatmapDay }) {
  const types = ACTIVITY_TYPES.filter((t) => (d.counts[t] ?? 0) > 0);
  const extra = d.companies.length - MAX_COMPANIES;
  return (
    <div className="space-y-1.5">
      <p className="flex items-center justify-between gap-4">
        <span className="font-medium">{formatTz(toDate(d.day), "UTC", "EEEE, MMM d")}</span>
        {d.met && (
          <span className="flex items-center gap-0.5 text-[11px] opacity-80">
            <Flame className="size-3" /> streak
          </span>
        )}
      </p>
      {types.length === 0 ? (
        <p className="opacity-70">Nothing logged</p>
      ) : (
        <ul className="space-y-0.5">
          {types.map((t) => (
            <li key={t} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: ACTIVITY_META[t].color }} />
                {ACTIVITY_META[t].label}
              </span>
              <span className="tabular font-medium">{d.counts[t]}</span>
            </li>
          ))}
        </ul>
      )}
      {d.companies.length > 0 && (
        <p className="border-t border-background/15 pt-1.5 text-[11px] leading-snug opacity-80">
          {d.companies.slice(0, MAX_COMPANIES).join(", ")}
          {extra > 0 && ` +${extra} more`}
        </p>
      )}
    </div>
  );
}
