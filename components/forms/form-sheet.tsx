"use client";

import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Kbd } from "@/components/ui/kbd";

/** Side sheet with a scrolling form body and a pinned footer. Ctrl/⌘+Enter submits. */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  formId,
  onSubmit,
  submitting,
  submitLabel = "Save",
  children,
  footerStart,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  formId: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
  submitLabel?: string;
  children: React.ReactNode;
  footerStart?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={`flex w-full flex-col gap-0 p-0 ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="text-base">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <form
          id={formId}
          onSubmit={onSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              e.currentTarget.requestSubmit();
            }
          }}
          className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
          noValidate
        >
          {children}
        </form>
        <SheetFooter className="flex-row items-center justify-between border-t px-5 py-3">
          <div className="text-xs text-muted-foreground">{footerStart ?? <span className="hidden sm:inline"><Kbd>Ctrl</Kbd> <Kbd>↵</Kbd> to save</span>}</div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form={formId} disabled={submitting}>
              {submitting && <LoaderCircle className="animate-spin" />}
              {submitLabel}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

export function DuplicateWarning({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="rounded-lg border border-status-withdrawn/30 bg-status-withdrawn/8 px-3 py-2 text-xs text-foreground/85">
      {children}
    </div>
  );
}
