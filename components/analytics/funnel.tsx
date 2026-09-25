"use client";

import { ChevronDown } from "lucide-react";
import { STATUS_META } from "@/lib/meta";
import { pct } from "@/lib/analytics-constants";
import type { OpportunityStatus } from "@/lib/domain";

/** Stage bars (colored as the stage, like everywhere else) with step conversion between them. */
export function Funnel({ steps }: { steps: { stage: OpportunityStatus; count: number; conversion: number | null }[] }) {
  const top = Math.max(1, steps[0]?.count ?? 1);
  return (
    <ol className="space-y-1">
      {steps.map((s, i) => (
        <li key={s.stage}>
          {i > 0 && (
            <div className="flex items-center gap-1.5 py-1 pl-28 text-[11px] text-muted-foreground">
              <ChevronDown className="size-3" />
              <span className="tabular font-medium text-foreground">{s.conversion === null ? "—" : pct(s.conversion)}</span>
              converted
            </div>
          )}
          <div className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_META[s.stage].color }} />
              {STATUS_META[s.stage].label}
            </span>
            <div className="h-5 rounded-md bg-muted/50">
              <div
                className="h-full rounded-md transition-[width] duration-500"
                style={{ width: `${Math.max(1.5, (s.count / top) * 100)}%`, backgroundColor: `color-mix(in oklch, ${STATUS_META[s.stage].color} 70%, transparent)` }}
              />
            </div>
            <span className="tabular w-8 text-right text-sm font-semibold">{s.count}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
