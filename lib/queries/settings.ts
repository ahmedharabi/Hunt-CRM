import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";

/** Memoized per request — every server component can call it freely. */
export const getSettings = cache(() => {
  const row = getDb().select().from(settings).where(eq(settings.id, 1)).get();
  if (!row) throw new Error("settings row missing — migrations did not run");
  return row;
});
