"use client";

import { useEffect, useState } from "react";
import { Flame, Trophy } from "lucide-react";
import { ProgressRing } from "./progress-ring";
import { useAppActions } from "@/components/quick-log/app-actions";
import { ACTIVITY_META } from "@/lib/meta";
import { ACTIVITY_TYPES, type ActivityType, type DailyGoals, type StreakMode } from "@/lib/domain";
import type { StreakTarget } from "@/lib/services/dashboard";
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

const STREAK_RULE: Record<StreakMode, string> = {
  any_activity: "A day counts when you log any outbound activity.",
  any_goal: "A day counts when you hit at least one streak target.",
  all_goals: "A day counts when you hit every streak target.",
};

const ROTATE_MS = 4000;

/**
 * Cycles through the streak targets still left today ("Applied 1/15 · 14 left",
 * then "Email 3/15 · 12 left"). Hovering or focusing pauses it.
 */
function TargetTicker({ targets }: { targets: StreakTarget[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = targets.length;
  useEffect(() => {
    if (count < 2 || paused) return;
    const id = setInterval(() => setIndex((i) => i + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, [count, paused]);
  const t = targets[index % count];
  const meta = ACTIVITY_META[t.type];
  const Icon = meta.icon;
  return (
    <p
      className="flex items-center gap-1 text-xs text-muted-foreground"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-live="polite"
    >
      <Icon key={t.type} className="size-3 shrink-0 animate-in fade-in" style={{ color: meta.color }} strokeWidth={2} />
      <span key={`${t.type}-label`} className="animate-in fade-in">
        {meta.short} <span className="tabular font-medium text-foreground">{t.count}/{t.goal}</span> · {t.goal - t.count} left
      </span>
    </p>
  );
}

export function StreakBadge({
  current,
  longest,
  todayMet,
  mode,
  targets,
}: {
  current: number;
  longest: number;
  todayMet: boolean;
  mode: StreakMode;
  targets: StreakTarget[];
}) {
  const remaining = targets.filter((t) => t.count < t.goal);
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-2" title={`${STREAK_RULE[mode]} Change your streak targets in Settings.`}>
      <Flame className={cn("size-5", current > 0 ? "text-brand" : "text-muted-foreground")} strokeWidth={1.85} fill={current > 0 ? "currentColor" : "none"} fillOpacity={0.15} />
      <div className="leading-tight">
        <p className="tabular text-sm font-semibold">
          {current} day{current === 1 ? "" : "s"}
          <span className="font-normal text-muted-foreground"> streak</span>
        </p>
        {todayMet ? (
          <p className="text-xs text-muted-foreground">Today counts ✓</p>
        ) : remaining.length ? (
          <TargetTicker targets={remaining} />
        ) : (
          <p className="text-xs text-muted-foreground">{current > 0 ? "Keep it alive today" : "Log anything to start one"}</p>
        )}
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
