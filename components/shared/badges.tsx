import type { Tier } from "@/lib/domain";
import { TIER_META } from "@/lib/meta";
import { cn } from "@/lib/utils";

/** Tier is shown by weight, not hue — status and activity colors keep the palette. */
export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[0.6875rem] font-medium whitespace-nowrap",
        tier === "dream" && "bg-brand-soft text-brand",
        tier === "target" && "bg-muted text-foreground/80",
        tier === "backup" && "border border-dashed text-muted-foreground",
        className,
      )}
    >
      {tier === "dream" && (
        <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
          <path d="M6 1.2 7.4 4.3l3.4.3-2.6 2.2.8 3.3L6 8.3 3 10.1l.8-3.3L1.2 4.6l3.4-.3z" fill="currentColor" />
        </svg>
      )}
      {TIER_META[tier].label}
    </span>
  );
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-md border bg-background px-1.5 text-[0.6875rem] whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** 1–5 (or 1–3) as filled dots. */
export function Dots({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${label}: ${value} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={cn("size-1.5 rounded-full", i < value ? "bg-foreground/70" : "bg-foreground/15")} />
      ))}
    </span>
  );
}

/** Priority as signal bars (1 = high → three bars). */
export function PriorityBars({ priority, className }: { priority: number; className?: string }) {
  const level = 4 - priority;
  const label = priority === 1 ? "High" : priority === 2 ? "Medium" : "Low";
  return (
    <svg viewBox="0 0 12 12" className={cn("size-3.5 shrink-0", className)} role="img" aria-label={`${label} priority`}>
      <title>{`${label} priority`}</title>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={1 + i * 3.8}
          y={9 - (i + 1) * 2.6 + 1.6}
          width="2.4"
          height={(i + 1) * 2.6 + 0.4}
          rx="0.6"
          className={i < level ? "fill-foreground/75" : "fill-foreground/15"}
        />
      ))}
    </svg>
  );
}
