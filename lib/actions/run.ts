import "server-only";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { DomainError } from "@/lib/services/automation";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Wraps a server action body: zod errors become field errors the form can
 * show inline, domain errors become readable messages, anything else is
 * logged and reported generically. Successful mutations revalidate the
 * whole app — it's one user and one SQLite file, so this is cheap.
 */
export async function run<T>(fn: () => T | Promise<T>, opts: { revalidate?: boolean } = {}): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    if (opts.revalidate !== false) revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        const key = issue.path.join(".") || "_";
        fieldErrors[key] ??= issue.message;
      }
      const first = error.issues[0];
      return { ok: false, error: first?.message ?? "Check the highlighted fields", fieldErrors };
    }
    if (error instanceof DomainError) return { ok: false, error: error.message };
    console.error("[hunt] action failed", error);
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong" };
  }
}
