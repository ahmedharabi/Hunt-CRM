"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { idSchema, noteSchema } from "@/lib/validators";
import { run } from "./run";

export async function createNote() {
  return run(() => {
    const row = getDb().insert(s.notes).values({}).returning({ id: s.notes.id }).get();
    return { id: row.id };
  });
}

/** Autosave from the editor. Revalidates so the list's title and preview follow along. */
export async function saveNote(id: number, input: unknown) {
  return run(() => {
    const values = noteSchema.parse(input);
    getDb().update(s.notes).set(values).where(eq(s.notes.id, idSchema.parse(id))).run();
    return { savedAt: new Date() };
  });
}

export async function setNotePinned(id: number, pinned: boolean) {
  return run(() => {
    getDb().update(s.notes).set({ pinned: z.boolean().parse(pinned) }).where(eq(s.notes.id, idSchema.parse(id))).run();
    return null;
  });
}
