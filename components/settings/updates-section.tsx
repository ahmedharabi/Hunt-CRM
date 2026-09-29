"use client";

import { useState } from "react";
import { ArrowUpCircle, CheckCircle2, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UpdateDialog, useUpdateStatus } from "@/components/layout/update-notice";
import { saveCheckUpdates } from "@/lib/actions/misc";
import { mutate } from "@/lib/client/mutate";

export function UpdatesSection({ version, enabled: initial, envDisabled }: { version: string; enabled: boolean; envDisabled: boolean }) {
  const { status, checking, check } = useUpdateStatus();
  const [enabled, setEnabled] = useState(initial);
  const [open, setOpen] = useState(false);

  const toggle = async (on: boolean) => {
    setEnabled(on);
    if (!(await mutate(saveCheckUpdates(on)))) return setEnabled(!on);
    void check();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm">
          Hunt <span className="tabular font-medium">v{version}</span>
        </p>
        <Status status={status} checking={checking} onOpen={() => setOpen(true)} />
        {status?.state !== "disabled" && (
          <Button variant="outline" size="sm" className="ml-auto" disabled={checking} onClick={check}>
            {checking ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}
            Check now
          </Button>
        )}
      </div>
      <div className="flex items-start justify-between gap-4">
        <Label htmlFor="check-updates" className="flex-col items-start gap-0.5 font-normal">
          <span className="font-medium">Check for updates</span>
          <span className="text-[0.8125rem] text-muted-foreground">
            {envDisabled
              ? "Turned off for this install by HUNT_UPDATE_CHECK=0."
              : "Asks GitHub for the latest release twice a day. Nothing about you or your data is sent."}
          </span>
        </Label>
        <Switch id="check-updates" checked={enabled && !envDisabled} disabled={envDisabled} onCheckedChange={toggle} />
      </div>
      {status?.state === "ok" && status.latest && (
        <UpdateDialog open={open} onOpenChange={setOpen} current={status.current} release={status.latest} />
      )}
    </div>
  );
}

function Status({ status, checking, onOpen }: { status: ReturnType<typeof useUpdateStatus>["status"]; checking: boolean; onOpen: () => void }) {
  if (!status || (checking && status.state !== "ok")) return null;
  const cls = "flex items-center gap-1.5 text-[0.8125rem]";
  if (status.state === "disabled") return <span className={`${cls} text-muted-foreground`}>Update checks are off</span>;
  if (status.state === "error")
    return (
      <span className={`${cls} text-muted-foreground`}>
        <TriangleAlert className="size-3.5" /> {status.error}
      </span>
    );
  if (status.available && status.latest)
    return (
      <button type="button" onClick={onOpen} className={`${cls} font-medium text-brand hover:underline`}>
        <ArrowUpCircle className="size-3.5" /> v{status.latest.version} is available
      </button>
    );
  return (
    <span className={`${cls} text-muted-foreground`}>
      <CheckCircle2 className="size-3.5 text-status-accepted" />
      {status.latest ? "You're up to date" : "No releases published yet"}
    </span>
  );
}
