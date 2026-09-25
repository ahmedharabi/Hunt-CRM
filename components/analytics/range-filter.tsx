"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const PRESETS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

/** One filter row above every chart; state lives in the URL so views are linkable. */
export function RangeFilter({ range, from, to, label }: { range: string; from?: string; to?: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(from ?? "");
  const [t, setT] = useState(to ?? "");
  const go = (qs: string) => router.push(`${pathname}?${qs}` as never, { scroll: false });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border p-0.5" role="group" aria-label="Date range">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={range === p.value}
            onClick={() => go(`range=${p.value}`)}
            className={cn(
              "h-7 rounded-md px-3 text-xs font-medium transition-colors",
              range === p.value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant={range === "custom" ? "secondary" : "outline"} size="sm" className="h-8">
            <CalendarRange data-icon="inline-start" />
            {range === "custom" ? label : "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!f || !t) return;
              setOpen(false);
              go(`range=custom&from=${f}&to=${t}`);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="range-from" className="text-xs">From</Label>
              <Input id="range-from" type="date" value={f} onChange={(e) => setF(e.target.value)} className="h-8" max={t || undefined} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="range-to" className="text-xs">To</Label>
              <Input id="range-to" type="date" value={t} onChange={(e) => setT(e.target.value)} className="h-8" min={f || undefined} />
            </div>
            <Button type="submit" size="sm" className="w-full" disabled={!f || !t}>
              Apply
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
