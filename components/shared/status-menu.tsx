"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { setOpportunityStatus } from "@/lib/actions/records";
import { ACTIVE_STATUSES, TERMINAL_STATUSES, canTransition, type OpportunityStatus } from "@/lib/domain";
import { STATUS_META } from "@/lib/meta";
import { cn } from "@/lib/utils";

/** Status badge that opens a menu to move the opportunity; disallowed moves are greyed out. */
export function StatusMenu({ opportunityId, status }: { opportunityId: number; status: OpportunityStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState<OpportunityStatus | null>(null);
  const current = optimistic ?? status;

  const move = (to: OpportunityStatus) =>
    start(async () => {
      setOptimistic(to);
      const r = await setOpportunityStatus([opportunityId], to);
      if (!r.ok || r.data.skipped) {
        setOptimistic(null);
        toast.error(r.ok ? (r.data.reason ?? "Not allowed") : r.error);
        return;
      }
      toast.success(`Moved to ${STATUS_META[to].label}`);
      router.refresh();
      setOptimistic(null);
    });

  const item = (s: OpportunityStatus) => (
    <DropdownMenuItem key={s} disabled={s !== current && !canTransition(current, s)} onSelect={() => s !== current && move(s)}>
      <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />
      {STATUS_META[s].label}
      {s === current && <Check className="ml-auto" />}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        aria-label={`Status: ${STATUS_META[current].label}. Change status`}
        className={cn("group/status flex items-center gap-0.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring", pending && "opacity-60")}
      >
        <StatusBadge status={current} />
        <ChevronDown className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover/status:opacity-100 group-focus-visible/status:opacity-100" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Move to</DropdownMenuLabel>
        {ACTIVE_STATUSES.map(item)}
        <DropdownMenuSeparator />
        {TERMINAL_STATUSES.map(item)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
