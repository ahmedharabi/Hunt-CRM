import type { ActivityType, OpportunityStatus } from "@/lib/domain";
import { ACTIVITY_META, STATUS_META } from "@/lib/meta";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: OpportunityStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-[11.5px] font-medium whitespace-nowrap",
        className,
      )}
      style={{
        color: meta.color,
        borderColor: `color-mix(in oklch, ${meta.color} 28%, transparent)`,
        backgroundColor: `color-mix(in oklch, ${meta.color} 9%, transparent)`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}

/** Square icon chip used in feeds and timelines. */
export function ActivityIcon({ type, className }: { type: ActivityType; className?: string }) {
  const meta = ACTIVITY_META[type];
  const Icon = meta.icon;
  return (
    <span
      className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md", className)}
      style={{ color: meta.color, backgroundColor: `color-mix(in oklch, ${meta.color} 12%, transparent)` }}
    >
      <Icon className="size-3.5" strokeWidth={2} />
    </span>
  );
}
