"use client";

import { useEffect, useState } from "react";
import { ArrowUpCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Markdown } from "@/components/shared/markdown";
import { DateText } from "@/components/shared/relative-time";
import type { Release, UpdateStatus } from "@/lib/services/updates";

const DISMISSED_KEY = "hunt:update-dismissed";

async function fetchStatus(force: boolean): Promise<UpdateStatus | null> {
  try {
    const res = await fetch(force ? "/api/updates?force" : "/api/updates");
    return res.ok ? await res.json() : null;
  } catch {
    return null; // offline: say nothing
  }
}

/** Reads /api/updates once per page load. The server caches GitHub's answer for 12 hours. */
export function useUpdateStatus() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);

  /** "Check now": skips the server's cache. */
  const check = async () => {
    setChecking(true);
    setStatus(await fetchStatus(true));
    setChecking(false);
  };

  useEffect(() => {
    let live = true;
    void fetchStatus(false).then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, []);

  return { status, checking, check };
}

function readDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

/** Sidebar item that appears only when a newer release is out and hasn't been skipped. */
export function UpdateNotice() {
  const { status } = useUpdateStatus();
  const [open, setOpen] = useState(false);
  // Nothing renders until the check answers, so reading storage up front can't cause a hydration mismatch.
  const [dismissed, setDismissed] = useState<string | null>(readDismissed);

  if (status?.state !== "ok" || !status.available || !status.latest || dismissed === status.latest.version) return null;
  const release = status.latest;

  const skip = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, release.version);
    } catch {
      /* private mode: it just comes back next time */
    }
    setDismissed(release.version);
    setOpen(false);
  };

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={() => setOpen(true)} tooltip={`Update available: v${release.version}`} className="text-brand hover:text-brand">
          <ArrowUpCircle />
          <span>Update available</span>
          <span className="ml-auto rounded-full bg-brand-soft px-1.5 text-[0.6875rem] tabular">v{release.version}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <UpdateDialog open={open} onOpenChange={setOpen} current={status.current} release={release} onSkip={skip} />
    </>
  );
}

export function UpdateDialog({
  open,
  onOpenChange,
  current,
  release,
  onSkip,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: string;
  release: Release;
  onSkip?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Hunt v{release.version} is available</DialogTitle>
          <DialogDescription>
            You have v{current}. Released <DateText value={new Date(release.publishedAt)} />.
          </DialogDescription>
        </DialogHeader>

        {release.notes.trim() && (
          <div className="max-h-[40svh] overflow-y-auto rounded-lg border bg-muted/30 px-4 py-3">
            <Markdown>{release.notes}</Markdown>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">How to update</p>
          <p className="text-xs text-muted-foreground">Your data in ./data stays where it is; migrations run on the next start.</p>
          <Tabs defaultValue="source">
            <TabsList>
              <TabsTrigger value="source">From source</TabsTrigger>
              <TabsTrigger value="desktop">Desktop app</TabsTrigger>
              <TabsTrigger value="docker">Docker</TabsTrigger>
            </TabsList>
            <TabsContent value="source">
              <Commands lines={["git pull", "npm install", "npm run build", "npm start   # or restart however you run it"]} />
            </TabsContent>
            <TabsContent value="desktop">
              <Commands lines={["git pull", "npm install", "npm run desktop:install", "# then quit and reopen Hunt"]} />
            </TabsContent>
            <TabsContent value="docker">
              <Commands lines={["docker compose pull", "docker compose up -d"]} />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {onSkip ? (
            <Button variant="ghost" onClick={onSkip}>
              Skip this version
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Later
            </Button>
            <Button asChild>
              <a href={release.url} target="_blank" rel="noreferrer">
                <ExternalLink data-icon="inline-start" />
                Release on GitHub
              </a>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Commands({ lines }: { lines: string[] }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-muted px-3 py-2.5 font-mono text-xs leading-relaxed">
      {lines.map((l) => (l.startsWith("#") ? l : `$ ${l}`)).join("\n")}
    </pre>
  );
}
