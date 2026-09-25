"use client";

import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/run";
import { deleteRecords, restoreRecords, type SoftDeletable } from "@/lib/actions/records";

/**
 * Run a server action and surface the outcome as a toast. Returns the data
 * on success, or null (after showing the error) on failure.
 */
export async function mutate<T>(
  action: Promise<ActionResult<T>>,
  opts: { success?: string | ((data: T) => string); silent?: boolean } = {},
): Promise<T | null> {
  const result = await action;
  if (!result.ok) {
    toast.error(result.error);
    return null;
  }
  if (!opts.silent && opts.success) {
    toast.success(typeof opts.success === "function" ? opts.success(result.data) : opts.success);
  }
  return result.data;
}

/** Soft-delete with an Undo action on the toast. */
export async function deleteWithUndo(entity: SoftDeletable, ids: number[], label: string, onDone?: () => void) {
  const result = await deleteRecords(entity, ids);
  if (!result.ok) {
    toast.error(result.error);
    return false;
  }
  onDone?.();
  toast(`Deleted ${label}`, {
    action: {
      label: "Undo",
      onClick: async () => {
        const r = await restoreRecords(entity, ids);
        if (r.ok) toast.success("Restored");
        else toast.error(r.error);
      },
    },
    duration: 6000,
  });
  return true;
}

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}
