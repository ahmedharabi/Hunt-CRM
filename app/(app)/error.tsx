"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/shared/page";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Page className="flex min-h-[60svh] items-center justify-center">
      <div className="flex max-w-sm flex-col items-center text-center">
        <span className="mb-4 inline-flex size-10 items-center justify-center rounded-lg border bg-card text-status-rejected">
          <TriangleAlert className="size-5" strokeWidth={1.75} />
        </span>
        <h2 className="text-base font-semibold">This screen hit an error</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error.message || "Something went wrong while loading."}
          {error.digest && <span className="mt-1 block font-mono text-xs">ref {error.digest}</span>}
        </p>
        <Button variant="outline" className="mt-5" onClick={() => retry()}>
          <RotateCw data-icon="inline-start" />
          Try again
        </Button>
      </div>
    </Page>
  );
}
