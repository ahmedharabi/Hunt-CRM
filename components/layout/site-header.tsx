"use client";

import { usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAppActions } from "@/components/quick-log/app-actions";
import { titleForPath } from "@/lib/nav";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  const pathname = usePathname();
  const { openPalette, quickLog } = useAppActions();
  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-4">
      <SidebarTrigger className="-ml-1 text-muted-foreground" />
      <Separator orientation="vertical" className="mr-1 data-vertical:h-4 data-vertical:self-center" />
      <h1 className="truncate text-sm font-medium">{titleForPath(pathname)}</h1>
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="outline"
          onClick={openPalette}
          className="hidden h-8 w-56 justify-start gap-2 px-2.5 font-normal text-muted-foreground sm:flex lg:w-72"
        >
          <Search strokeWidth={1.85} />
          <span className="flex-1 text-left">Search or jump to…</span>
          <Kbd>Ctrl K</Kbd>
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={openPalette} aria-label="Search" className="text-muted-foreground sm:hidden">
          <Search strokeWidth={1.85} />
        </Button>
        <Button onClick={() => quickLog()} className="hidden h-8 md:flex">
          <Plus data-icon="inline-start" strokeWidth={2.25} />
          Log
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
