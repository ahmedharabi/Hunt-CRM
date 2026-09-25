"use client";

import { useState } from "react";
import { ChartNoAxesColumn, Info, Table2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MIN_SAMPLE } from "@/lib/analytics-constants";
import { cn } from "@/lib/utils";

export type TableSpec = { columns: string[]; rows: (string | number)[][] };

/**
 * Every chart: a title, a tooltip defining the metric, a small-sample warning,
 * an empty state, and a table view (tooltips never gate a value).
 */
export function ChartCard({
  title,
  info,
  sample,
  empty,
  table,
  className,
  children,
  aside,
}: {
  title: string;
  info: string;
  /** Data points behind the metric; below MIN_SAMPLE shows a warning. */
  sample?: number;
  empty?: boolean;
  table?: TableSpec;
  className?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  const small = sample !== undefined && sample > 0 && sample < MIN_SAMPLE;
  return (
    <section className={cn("flex flex-col rounded-xl border bg-card", className)}>
      <header className="flex items-center gap-1.5 px-4 pt-3.5 pb-2">
        <h3 className="text-[13px] font-medium">{title}</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="rounded p-0.5 text-muted-foreground/70 hover:text-foreground" aria-label={`About ${title}`}>
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-72 text-xs leading-relaxed">{info}</TooltipContent>
        </Tooltip>
        {small && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ml-1 inline-flex items-center gap-1 rounded-md bg-status-withdrawn/12 px-1.5 py-0.5 text-[11px] text-status-withdrawn">
                <TriangleAlert className="size-3" />
                n={sample}
              </span>
            </TooltipTrigger>
            <TooltipContent>Fewer than {MIN_SAMPLE} data points — treat as a hint, not a trend.</TooltipContent>
          </Tooltip>
        )}
        <div className="ml-auto flex items-center gap-1">
          {aside}
          {table && !empty && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setAsTable((v) => !v)}
              aria-pressed={asTable}
              aria-label={asTable ? "Show chart" : "Show table"}
              className="text-muted-foreground"
            >
              {asTable ? <ChartNoAxesColumn /> : <Table2 />}
            </Button>
          )}
        </div>
      </header>
      <div className="flex-1 px-4 pb-4">
        {empty ? (
          <div className="flex h-full min-h-32 flex-col items-center justify-center gap-1 text-center">
            <ChartNoAxesColumn className="size-5 text-muted-foreground/60" strokeWidth={1.75} />
            <p className="text-xs text-muted-foreground">Not enough data in this range yet.</p>
          </div>
        ) : asTable && table ? (
          <div className="max-h-72 overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  {table.columns.map((c, i) => (
                    <th key={c} className={cn("px-2.5 py-1.5 font-medium whitespace-nowrap", i === 0 ? "text-left" : "text-right")}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((v, j) => (
                      <td key={j} className={cn("px-2.5 py-1.5 whitespace-nowrap", j === 0 ? "text-left" : "tabular text-right")}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
