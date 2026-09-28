"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { UPLOAD_DIR } from "@/db/paths";
import { clearSeed } from "@/db/seed-data";
import { importBackup, resetDatabase, validateBackup } from "@/lib/services/backup";
import {
  idSchema,
  resumeSchema,
  savedViewSchema,
  settingsSchema,
  templateSchema,
  textScaleSchema,
  weeklyNotesSchema,
  type TemplateInput,
} from "@/lib/validators";
import { run } from "./run";

/* ─────────────────────────── templates ─────────────────────────── */

export async function saveTemplate(input: TemplateInput, id?: number) {
  return run(() => {
    const values = templateSchema.parse(input);
    const db = getDb();
    const row = id
      ? db.update(s.templates).set(values).where(eq(s.templates.id, id)).returning().get()
      : db.insert(s.templates).values(values).returning().get();
    return { id: row.id };
  });
}

/* ─────────────────────────── settings ─────────────────────────── */

export async function saveSettings(input: unknown) {
  return run(() => {
    const values = settingsSchema.parse(input);
    getDb().update(s.settings).set(values).where(eq(s.settings.id, 1)).run();
    return null;
  });
}

export async function saveTextScale(input: unknown) {
  return run(() => {
    const textScale = textScaleSchema.parse(input);
    getDb().update(s.settings).set({ textScale }).where(eq(s.settings.id, 1)).run();
    return null;
  });
}

/* ─────────────────────────── saved views ─────────────────────────── */

export async function saveView(input: unknown) {
  return run(() => {
    const v = savedViewSchema.parse(input);
    const row = getDb().insert(s.savedViews).values(v).returning().get();
    return { id: row.id, name: row.name };
  });
}

/* ─────────────────────────── weekly review ─────────────────────────── */

export async function saveWeeklyNotes(input: unknown) {
  return run(
    () => {
      const { weekStart, notes } = weeklyNotesSchema.parse(input);
      getDb()
        .insert(s.weeklyReviews)
        .values({ weekStart, notes })
        .onConflictDoUpdate({ target: s.weeklyReviews.weekStart, set: { notes, deletedAt: null } })
        .run();
      return { savedAt: new Date() };
    },
    // Autosave: don't re-render the page under the user's cursor.
    { revalidate: false },
  );
}

/* ─────────────────────────── resumes ─────────────────────────── */

const MAX_UPLOAD = 10 * 1024 * 1024;
const ALLOWED = new Set([".pdf", ".doc", ".docx", ".md", ".txt"]);

export async function saveResume(formData: FormData, id?: number) {
  return run(async () => {
    const values = resumeSchema.parse({
      name: formData.get("name"),
      description: formData.get("description"),
      fileUrl: formData.get("fileUrl"),
    });
    let filePath: string | undefined;
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED.has(ext)) throw new Error("Upload a PDF, Word, Markdown or text file");
      if (file.size > MAX_UPLOAD) throw new Error("Files must be under 10 MB");
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      // Random name on disk; the original name is kept for downloads.
      const stored = `${randomUUID()}${ext}`;
      await fs.writeFile(path.join(UPLOAD_DIR, stored), Buffer.from(await file.arrayBuffer()));
      filePath = `${stored}|${file.name.replace(/[^\w.\- ]+/g, "_")}`;
    }
    const db = getDb();
    const row = id
      ? db
          .update(s.resumeVersions)
          .set({ ...values, ...(filePath ? { filePath } : {}) })
          .where(eq(s.resumeVersions.id, id))
          .returning()
          .get()
      : db.insert(s.resumeVersions).values({ ...values, filePath }).returning().get();
    return { id: row.id };
  });
}

/* ─────────────────────────── data management ─────────────────────────── */

export async function importJsonBackup(json: string) {
  return run(() => {
    const backup = validateBackup(JSON.parse(json));
    return importBackup(getDb(), backup);
  });
}

export async function resetAllData(confirmation: string) {
  return run(() => {
    if (confirmation !== "reset") throw new Error('Type "reset" to confirm');
    resetDatabase(getDb());
    return null;
  });
}

export async function clearSampleData() {
  return run(() => {
    clearSeed(getDb());
    return null;
  });
}

export async function hasSampleData() {
  return run(
    () =>
      !!getDb()
        .select({ id: s.companies.id })
        .from(s.companies)
        .where(and(eq(s.companies.isSeed, true), isNull(s.companies.deletedAt)))
        .get(),
    { revalidate: false },
  );
}

export async function deleteView(id: number) {
  return run(() => {
    getDb().delete(s.savedViews).where(eq(s.savedViews.id, idSchema.parse(id))).run();
    return null;
  });
}
