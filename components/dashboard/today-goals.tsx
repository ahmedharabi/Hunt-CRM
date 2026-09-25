"use client";

import { Flame, Trophy } from "lucide-react";
import { ProgressRing } from "./progress-ring";
import { useAppActions } from "@/components/quick-log/app-actions";
import { ACTIVITY_META } from "@/lib/meta";
import { ACTIVITY_TYPES, type ActivityType, type DailyGoals } from "@/lib/domain";
import { cn } from "@/lib/utils";

/** Today's counts vs daily goals. Each ring is a shortcut to log that type. */
export function TodayGoals({ counts, goals }: { counts: Partial<Record<ActivityType, number>>; goals: DailyGoals }) {
  const { quickLog } = useAppActions();
  const types = ACTIVITY_TYPES.filter((t) => (goals[t] ?? 0) > 0);
  const extra = ACTIVITY_TYPES.filter((t) => !(goals[t] ?? 0) && (counts[t] ?? 0) > 0);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {types.map((t) => {
        const meta = ACTIVITY_META[t];
        const Icon = meta.icon;
        const n = counts[t] ?? 0;
        const goal = goals[t]!;
        return (
          <button
            key={t}
            type="button"
            onClick={() => quickLog({ type: t })}
            className="group flex items-center gap-3 rounded-lg border bg-background/50 p-2.5 text-left transition-colors hover:border-foreground/20 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={`${meta.label}: ${n} of ${goal}. Log one.`}
          >
            <ProgressRing value={n} goal={goal} color={meta.color}>
              <Icon className="size-4" strokeWidth={2} style={{ color: n >= goal ? meta.color : undefined }} />
            </ProgressRing>
            <div className="min-w-0">
              <p className="tabular text-lg leading-none font-semibold tracking-tight">
                {n}
                <span className="text-sm font-normal text-muted-foreground">/{goal}</span>
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground group-hover:text-foreground">{meta.short}</p>
            </div>
          </button>
        );
      })}
      {extra.length > 0 && (
        <div className="col-span-full flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
          Also today:
          {extra.map((t) => (
            <span key={t} className="tabular">
              {counts[t]} {ACTIVITY_META[t].label.toLowerCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function StreakBadge({ current, longest, todayMet }: { current: number; longest: number; todayMet: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-2">
      <Flame className={cn("size-5", current > 0 ? "text-brand" : "text-muted-foreground")} strokeWidth={1.85} fill={current > 0 ? "currentColor" : "none"} fillOpacity={0.15} />
      <div className="leading-tight">
        <p className="tabular text-sm font-semibold">
          {current} day{current === 1 ? "" : "s"}
          <span className="font-normal text-muted-foreground"> streak</span>
        </p>
        <p className="text-xs text-muted-foreground">{todayMet ? "Today counts ✓" : current > 0 ? "Keep it alive today" : "Start one today"}</p>
      </div>
      <span className="mx-1 h-7 w-px bg-border" />
      <Trophy className="size-4 text-muted-foreground" strokeWidth={1.85} />
      <div className="leading-tight">
        <p className="tabular text-sm font-semibold">{longest}</p>
        <p className="text-xs text-muted-foreground">best</p>
      </div>
    </div>
  );
}
