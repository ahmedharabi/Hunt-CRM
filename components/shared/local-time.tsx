"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";

// A shared one-minute clock; the server snapshot is null so SSR renders nothing time-dependent.
let listeners: (() => void)[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let now = Date.now();
function subscribe(cb: () => void) {
  listeners.push(cb);
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners = listeners.filter((l) => l !== cb);
    if (!listeners.length && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
export const useNow = () => useSyncExternalStore(subscribe, () => now, () => null);

/**
 * The company's current local time, with a hint when it's outside
 * 8am–6pm there — messages sent at 2am their time tend to sink.
 */
export function CompanyLocalTime({ timezone, className, compact }: { timezone: string | null; className?: string; compact?: boolean }) {
  const current = useNow();
  if (!timezone || current === null) return null;
  let hour: number;
  let label: string;
  try {
    hour = Number(formatInTimeZone(current, timezone, "H"));
    label = formatInTimeZone(current, timezone, "HH:mm");
  } catch {
    return null;
  }
  const off = hour < 8 || hour >= 18;
  const Icon = off ? Moon : Sun;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs", off ? "text-status-withdrawn" : "text-muted-foreground", className)}
      title={`${timezone}${off ? " — outside 8am–6pm there" : ""}`}
    >
      <Icon className="size-3.5" strokeWidth={1.85} />
      <span className="tabular">{label}</span>
      {!compact && <span>{off ? "there · outside work hours" : "their time"}</span>}
    </span>
  );
}
