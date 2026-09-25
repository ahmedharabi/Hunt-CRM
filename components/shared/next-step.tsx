"use client";

import { CalendarClock, CornerDownRight, Hourglass } from "lucide-react";
import { usePrefs } from "@/components/providers/prefs";
import { formatTz, relativeShort } from "@/lib/dates";
import { cn } from "@/lib/utils";

// "Tomorrow" reads better mid-sentence as "tomorrow"; dates keep their capitals.
const soft = (label: string) => (/^(Tomorrow|Yesterday)$/.test(label) ? label.toLowerCase() : label);

/** The most urgent upcoming thing for an opportunity: interview, follow-up, or deadline. */
export function NextStep({
  nextInterviewAt,
  nextFollowUpAt,
  deadline,
  now,
  className,
}: {
  nextInterviewAt: number | null;
  nextFollowUpAt: number | null;
  deadline: number | null;
  now: number;
  className?: string;
}) {
  const { timezone } = usePrefs();
  const items = [
    nextInterviewAt && { at: nextInterviewAt, icon: CalendarClock, label: `Interview ${formatTz(nextInterviewAt, timezone, "EEE d MMM, HH:mm")}` },
    nextFollowUpAt && {
      at: nextFollowUpAt,
      icon: CornerDownRight,
      label: nextFollowUpAt < now ? `Follow up · overdue` : `Follow up ${soft(relativeShort(nextFollowUpAt, now, timezone))}`,
      overdue: nextFollowUpAt < now,
    },
    deadline && deadline >= now - 86_400_000 && { at: deadline, icon: Hourglass, label: `Deadline ${formatTz(deadline, timezone, "MMM d")}` },
  ].filter(Boolean) as { at: number; icon: typeof CalendarClock; label: string; overdue?: boolean }[];
  const next = items.sort((a, b) => a.at - b.at)[0];
  if (!next) return <span className={cn("text-muted-foreground/60", className)}>—</span>;
  const Icon = next.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", next.overdue ? "text-brand" : "text-muted-foreground", className)}>
      <Icon className="size-3.5 shrink-0" strokeWidth={1.85} />
      {next.label}
    </span>
  );
}
