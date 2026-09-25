import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft } from "lucide-react";

export function BackLink({ href, children }: { href: Route; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-4 -ml-1 inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[13px] text-muted-foreground hover:text-foreground">
      <ChevronLeft className="size-4" />
      {children}
    </Link>
  );
}
