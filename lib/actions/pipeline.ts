"use server";

import { z } from "zod";
import { getDb } from "@/db/client";
import { moveCard } from "@/lib/services/automation";
import { OPPORTUNITY_STATUSES } from "@/lib/domain";
import { idSchema } from "@/lib/validators";
import { run } from "./run";

/** Drag-and-drop: status change (validated + history) and new column order, atomically. */
export async function moveOpportunity(id: number, to: string, orderedIds: number[]) {
  return run(() => {
    const r = moveCard(getDb(), idSchema.parse(id), z.enum(OPPORTUNITY_STATUSES).parse(to), z.array(idSchema).max(2000).parse(orderedIds));
    return { statusChange: r.statusChange };
  });
}
