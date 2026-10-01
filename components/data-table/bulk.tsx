"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { addTag, setOpportunityStatus } from "@/lib/actions/records";
import { setOutcome } from "@/lib/actions/activities";
import { PICKABLE_STATUSES, ACTIVITY_OUTCOMES } from "@/lib/domain";
import { OUTCOME_META, STATUS_META } from "@/lib/meta";

export function BulkTagButton({ entity, ids, onDone }: { entity: "companies" | "opportunities"; ids: number[]; onDone: () => void }) {
  const router = useRouter();
  const [tag, setTag] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Tag data-icon="inline-start" />
          Add tag
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-60 p-2">
        <form
          className="flex gap-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await addTag(entity, ids, tag);
            if (!r.ok) return toast.error(r.error);
            toast.success(`Tagged ${ids.length} with “${r.data.name}”`);
            setTag("");
            setOpen(false);
            onDone();
            router.refresh();
          }}
        >
          <Input autoFocus value={tag} onChange={(e) => setTag(e.target.value)} placeholder="tag name" className="h-8" aria-label="Tag" />
          <Button size="sm" type="submit" disabled={!tag.trim()} className="h-8">
            Add
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function BulkStatusButton({ ids, onDone }: { ids: number[]; onDone: () => void }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowRightLeft data-icon="inline-start" />
          Status
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="w-44">
        {PICKABLE_STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={async () => {
              const r = await setOpportunityStatus(ids, s);
              if (!r.ok) return toast.error(r.error);
              const { changed, skipped, reason } = r.data;
              if (changed) toast.success(`Moved ${changed} to ${STATUS_META[s].label}`);
              if (skipped) toast.warning(`${skipped} skipped — ${reason}`);
              onDone();
              router.refresh();
            }}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />
            {STATUS_META[s].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BulkOutcomeButton({ ids, onDone }: { ids: number[]; onDone: () => void }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowRightLeft data-icon="inline-start" />
          Outcome
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="w-44">
        {ACTIVITY_OUTCOMES.map((o) => (
          <DropdownMenuItem
            key={o}
            onSelect={async () => {
              const r = await setOutcome(ids, o);
              if (!r.ok) return toast.error(r.error);
              toast.success(`Marked ${ids.length} as ${OUTCOME_META[o].label.toLowerCase()}`);
              onDone();
              router.refresh();
            }}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: OUTCOME_META[o].color }} />
            {OUTCOME_META[o].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
