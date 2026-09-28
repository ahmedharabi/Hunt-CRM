"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MIN_SAMPLE, pct } from "@/lib/analytics-constants";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Reply rate by weekday × hour sent (your local time). Sequential single
 * hue: darker = better reply rate. Cells with too few sends stay hollow.
 */
export function SendHeatmap({ cells, weekStartsOn }: { cells: { dow: number; hour: number; sent: number; replied: number }[]; weekStartsOn: number }) {
  const map = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c]));
  const hours = cells.length ? cells.map((c) => c.hour) : [9, 18];
  const minH = Math.max(0, Math.min(7, ...hours));
  const maxH = Math.min(23, Math.max(21, ...hours));
  const hourList = Array.from({ length: maxH - minH + 1 }, (_, i) => minH + i);
  const order = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
  const best = [...cells].filter((c) => c.sent >= MIN_SAMPLE).sort((a, b) => b.replied / b.sent - a.replied / a.sent)[0];

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `2.25rem repeat(${hourList.length}, minmax(14px, 1fr))` }}>
          <span />
          {hourList.map((h) => (
            <span key={h} className="tabular text-center text-[0.625rem] text-muted-foreground">
              {h % 3 === 0 ? h : ""}
            </span>
          ))}
          {order.map((dow) => (
            <div key={dow} className="contents">
              <span className="text-[0.6875rem] leading-[18px] text-muted-foreground">{DAYS[dow]}</span>
              {hourList.map((h) => {
                const c = map.get(`${dow}-${h}`);
                const rate = c && c.sent ? c.replied / c.sent : 0;
                const enough = !!c && c.sent >= 2;
                return (
                  <Tooltip key={h}>
                    <TooltipTrigger asChild>
                      <span
                        tabIndex={c ? 0 : -1}
                        className={cn("h-[18px] rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring", !c && "bg-muted/50", c && !enough && "border border-brand/40")}
                        style={enough ? { backgroundColor: `color-mix(in oklch, var(--brand) ${Math.round(12 + rate * 88)}%, var(--muted))` } : undefined}
                      />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      {DAYS[dow]} {String(h).padStart(2, "0")}:00 —{" "}
                      {c ? `${c.replied}/${c.sent} replied (${pct(rate)})${c.sent < MIN_SAMPLE ? " · small sample" : ""}` : "nothing sent"}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {best ? (
            <>
              Best slot: <span className="font-medium text-foreground">{DAYS[best.dow]} around {String(best.hour).padStart(2, "0")}:00</span> ({pct(best.replied / best.sent)} of{" "}
              {best.sent})
            </>
          ) : (
            "Send a few more messages to find your best slot."
          )}
        </span>
        <span className="flex items-center gap-1">
          0%
          {[12, 34, 56, 78, 100].map((p) => (
            <span key={p} className="size-3 rounded-[3px]" style={{ backgroundColor: `color-mix(in oklch, var(--brand) ${p}%, var(--muted))` }} />
          ))}
          100% reply rate
        </span>
      </div>
    </div>
  );
}
