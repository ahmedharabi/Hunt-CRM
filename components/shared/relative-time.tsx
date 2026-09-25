"use client";

import { usePrefs } from "@/components/providers/prefs";
import { formatTz, relativeShort } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Relative label computed against a `now` passed down from the server
 * render, so the server and client produce the same text.
 */
export function RelativeTime({ value, now, className }: { value: number | Date | null | undefined; now: number; className?: string }) {
  const { timezone } = usePrefs();
  if (value == null) return <span className={cn("text-muted-foreground/60", className)}>—</span>;
  const d = typeof value === "number" ? value : value.getTime();
  return (
    <time dateTime={new Date(d).toISOString()} title={formatTz(d, timezone, "PPpp")} className={cn("tabular whitespace-nowrap", className)}>
      {relativeShort(d, now, timezone)}
    </time>
  );
}

export function DateText({ value, pattern = "MMM d, yyyy", className }: { value: number | Date | null | undefined; pattern?: string; className?: string }) {
  const { timezone } = usePrefs();
  if (value == null) return <span className={cn("text-muted-foreground/60", className)}>—</span>;
  return (
    <time dateTime={new Date(value).toISOString()} className={cn("tabular whitespace-nowrap", className)}>
      {formatTz(value, timezone, pattern)}
    </time>
  );
}
