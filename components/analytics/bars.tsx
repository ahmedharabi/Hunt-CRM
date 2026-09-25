"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MIN_SAMPLE } from "@/lib/analytics-constants";
import { cn } from "@/lib/utils";

export type BarRow = {
  key: string;
  label: string;
  /** Bar length, 0..max */
  value: number;
  /** Text at the bar end */
  display: string;
  /** Secondary muted text, e.g. "12 of 40" */
  detail?: string;
  /** Sample size for this row (dims the bar when small) */
  n?: number;
  color?: string;
  tooltip?: string;
};

/**
 * Horizontal bars: label, thin rounded bar from a common baseline, value at
 * the tip. Single-series lists use one color; rows with n < 5 render faded.
 */
export function BarList({ rows, max, color = "var(--brand)", labelWidth = "w-32" }: { rows: BarRow[]; max?: number; color?: string; labelWidth?: string }) {
  const top = max ?? Math.max(...rows.map((r) => r.value), 0.0001);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const small = r.n !== undefined && r.n < MIN_SAMPLE;
        return (
          <li key={r.key}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" tabIndex={0}>
                  <span className={cn("truncate text-xs text-muted-foreground group-hover:text-foreground", labelWidth)} title={r.label}>
                    {r.label}
                  </span>
                  <div className="relative h-2 rounded-full bg-muted/60">
                    <div
                      className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-500", small && "opacity-45")}
                      style={{ width: `${Math.max(2, (r.value / top) * 100)}%`, backgroundColor: r.color ?? color }}
                    />
                  </div>
                  <span className="tabular min-w-12 text-right text-xs">
                    <span className="font-medium">{r.display}</span>
                    {r.detail && <span className="ml-1.5 text-muted-foreground">{r.detail}</span>}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {r.tooltip ?? `${r.label}: ${r.display}${r.detail ? ` (${r.detail})` : ""}`}
                {small && " · small sample"}
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}
