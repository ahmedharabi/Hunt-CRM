"use client";

import { useMemo, useState } from "react";
import { CalendarX2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrefs } from "@/components/providers/prefs";
import { startOfDayTz, startOfMonthTz, startOfWeekTz } from "@/lib/dates";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;

const PERIODS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
] as const;
type Period = (typeof PERIODS)[number]["value"];

/**
 * Narrows rows to a calendar period (in the settings timezone and week start).
 * Rows with no date only show under "All time".
 */
export function usePeriodFilter<T>(rows: T[], dateOf: (row: T) => number | null, now: number) {
  const { timezone, weekStartsOn } = usePrefs();
  const [period, setPeriod] = useState<Period>("all");

  const ranges = useMemo(() => {
    const today = +startOfDayTz(now, timezone);
    // Start of yesterday via the day before today's midnight (safe across DST).
    const yesterday = +startOfDayTz(today - DAY / 2, timezone);
    return {
      today: [today, Infinity],
      yesterday: [yesterday, today],
      week: [+startOfWeekTz(now, timezone, weekStartsOn), Infinity],
      month: [+startOfMonthTz(now, timezone), Infinity],
    } satisfies Record<Exclude<Period, "all">, [number, number]>;
  }, [now, timezone, weekStartsOn]);

  const { filtered, counts } = useMemo(() => {
    const inRange = (p: Period, row: T) => {
      if (p === "all") return true;
      const d = dateOf(row);
      const [from, to] = ranges[p];
      return d != null && d >= from && d < to;
    };
    const counts = Object.fromEntries(PERIODS.map((p) => [p.value, rows.filter((r) => inRange(p.value, r)).length])) as Record<Period, number>;
    return { filtered: period === "all" ? rows : rows.filter((r) => inRange(period, r)), counts };
  }, [rows, dateOf, ranges, period]);

  return { period, setPeriod, filtered, counts };
}

export function PeriodTabs({ period, onChange, counts }: { period: Period; onChange: (p: Period) => void; counts: Record<Period, number> }) {
  return (
    <div role="tablist" aria-label="Time period" className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
      {PERIODS.map((p) => {
        const active = period === p.value;
        return (
          <button
            key={p.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(p.value)}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors",
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
            <span className={cn("tabular text-xs", active ? "text-muted-foreground" : "text-muted-foreground/70")}>{counts[p.value]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Table empty state when the period, not the data, is what's empty. */
export function PeriodEmpty({ period, onShowAll }: { period: Period; onShowAll: () => void }) {
  const label = PERIODS.find((p) => p.value === period)?.label.toLowerCase();
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-center">
      <CalendarX2 className="size-5 text-muted-foreground" strokeWidth={1.75} />
      <p className="text-sm text-muted-foreground">Nothing {label === "today" || label === "yesterday" ? label : `from ${label}`}.</p>
      <Button variant="outline" size="sm" onClick={onShowAll}>
        Show all time
      </Button>
    </div>
  );
}
