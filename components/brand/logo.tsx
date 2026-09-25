import { cn } from "@/lib/utils";

/** "H" with a rising crossbar — the mark reads as progress, not a crosshair. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-6", className)}>
      <rect width="24" height="24" rx="6.5" fill="var(--brand)" />
      <path
        d="M7.75 6.5v11M16.25 6.5v11M7.75 13.6 16.25 10.4"
        stroke="var(--brand-foreground)"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[-0.02em]">Hunt</span>
    </span>
  );
}
