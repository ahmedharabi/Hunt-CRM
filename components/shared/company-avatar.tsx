import { cn } from "@/lib/utils";

function hue(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}

/**
 * Logo if we have one, otherwise initials on a tint derived from the name —
 * stable across renders and themes, low chroma so it never competes with
 * status colors.
 */
export function CompanyAvatar({
  name,
  logoUrl,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md text-[0.65625rem] font-semibold tracking-tight",
        "bg-[oklch(0.94_0.035_var(--h))] text-[oklch(0.42_0.09_var(--h))] ring-1 ring-[oklch(0.5_0.05_var(--h)/0.14)] ring-inset",
        "dark:bg-[oklch(0.3_0.05_var(--h))] dark:text-[oklch(0.86_0.07_var(--h))] dark:ring-[oklch(0.8_0.05_var(--h)/0.1)]",
        className,
      )}
      style={{ ["--h" as string]: hue(name) }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
