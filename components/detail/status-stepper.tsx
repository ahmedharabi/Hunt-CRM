"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { setOpportunityStatus } from "@/lib/actions/records";
import { ACTIVE_STATUSES, PICKABLE_STATUSES, isTerminal, type OpportunityStatus } from "@/lib/domain";
import { STATUS_META } from "@/lib/meta";
import { cn } from "@/lib/utils";

/**
 * Pipeline stages as a clickable stepper; Rejected lives in a menu. The
 * choices are the board's columns.
 */
const STEPS = PICKABLE_STATUSES.filter((s) => !isTerminal(s));
const CLOSING = PICKABLE_STATUSES.filter(isTerminal);

export function StatusStepper({ opportunityId, status, reached }: { opportunityId: number; status: OpportunityStatus; reached: OpportunityStatus[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState<OpportunityStatus | null>(null);
  const [reason, setReason] = useState("");
  const current = optimistic ?? status;
  const currentIdx = (ACTIVE_STATUSES as readonly string[]).indexOf(current);

  const move = (to: OpportunityStatus, why?: string) =>
    start(async () => {
      setOptimistic(to);
      const r = await setOpportunityStatus([opportunityId], to, why);
      if (!r.ok || r.data.skipped) {
        setOptimistic(null);
        toast.error(r.ok ? (r.data.reason ?? "Not allowed") : r.error);
        return;
      }
      toast.success(`Moved to ${STATUS_META[to].label}`);
      router.refresh();
      setOptimistic(null);
    });

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <ol className="flex flex-1 items-center gap-1 overflow-x-auto" aria-label="Pipeline stage">
        {STEPS.map((s) => {
          const done = reached.includes(s) && (isTerminal(current) || (ACTIVE_STATUSES as readonly string[]).indexOf(s) < currentIdx);
          const isCurrent = s === current;
          const allowed = s !== current;
          const color = STATUS_META[s].color;
          const button = (
            <button
              type="button"
              disabled={!allowed || pending}
              onClick={() => move(s)}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "group/step flex h-8 w-full min-w-24 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
                isCurrent && "border-transparent text-white dark:text-background",
                !isCurrent && done && "border-transparent",
                !isCurrent && !done && "text-muted-foreground",
                allowed && "cursor-pointer hover:border-foreground/30 hover:text-foreground",
                !allowed && !isCurrent && "cursor-default",
              )}
              style={
                isCurrent
                  ? { backgroundColor: color }
                  : done
                    ? { backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`, color }
                    : undefined
              }
            >
              {done && <Check className="size-3.5" strokeWidth={2.5} />}
              {STATUS_META[s].label}
            </button>
          );
          return (
            <li key={s} className="flex-1">
              {allowed ? (
                <Tooltip>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent>Move to {STATUS_META[s].label}</TooltipContent>
                </Tooltip>
              ) : (
                button
              )}
            </li>
          );
        })}
      </ol>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 shrink-0" disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : isTerminal(current) ? <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_META[current].color }} /> : null}
            {isTerminal(current) ? STATUS_META[current].label : "Close"}
            <ChevronDown data-icon="inline-end" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 space-y-1 p-1.5">
          {CLOSING.map((s) => {
            const allowed = s !== current;
            if (s === "rejected") {
              return (
                <form
                  key={s}
                  className="space-y-1.5 rounded-md p-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    move("rejected", reason || undefined);
                  }}
                >
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="h-8" disabled={!allowed} />
                  <Button type="submit" size="sm" variant="outline" className="w-full justify-start" disabled={!allowed}>
                    <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_META.rejected.color }} />
                    Mark rejected
                  </Button>
                </form>
              );
            }
            return (
              <Button key={s} variant="ghost" size="sm" className="w-full justify-start" disabled={!allowed} onClick={() => move(s)}>
                <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />
                Mark {STATUS_META[s].label.toLowerCase()}
              </Button>
            );
          })}
          {isTerminal(current) && (
            <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">To reopen, click a stage on the left.</p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
