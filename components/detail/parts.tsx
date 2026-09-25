import { cn } from "@/lib/utils";

/** Bordered side panel with a title row. */
export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border bg-card", className)}>
      <header className="flex h-11 items-center justify-between border-b px-4">
        <h3 className="text-[13px] font-medium">{title}</h3>
        {action}
      </header>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function MetaItem({ icon: Icon, children }: { icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {Icon && <Icon className="size-3.5 text-muted-foreground/80" strokeWidth={1.85} />}
      {children}
    </span>
  );
}

export function StatStrip({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card sm:grid-cols-4 [&>div]:border-border max-sm:[&>div:nth-child(-n+2)]:border-b max-sm:[&>div:nth-child(odd)]:border-r sm:[&>div:not(:last-child)]:border-r">
      {items.map((i) => (
        <div key={i.label} className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">{i.label}</dt>
          <dd className="tabular mt-0.5 text-lg font-semibold tracking-tight">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
