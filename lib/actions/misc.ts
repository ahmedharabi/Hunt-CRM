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
import { companiesMissingLogos, fillCompanyLogo } from "@/lib/services/favicon";
import { BACKGROUND_ROUTE, BACKGROUND_TYPES } from "@/lib/appearance";
import {
  idSchema,
  resumeSchema,
  savedViewSchema,
  settingsSchema,
  templateSchema,
  textScaleSchema,
  colorThemeSchema,
  dashboardLayoutSchema,
  backgroundStyleSchema,
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

/** `null` resets to the default layout. */
export async function saveDashboardLayout(input: unknown) {
  return run(() => {
    const dashboardLayout = input === null ? null : dashboardLayoutSchema.parse(input);
    getDb().update(s.settings).set({ dashboardLayout }).where(eq(s.settings.id, 1)).run();
    return null;
  });
}

export async function saveColorTheme(input: unknown) {
  return run(() => {
    const colorTheme = colorThemeSchema.parse(input);
    getDb().update(s.settings).set({ colorTheme }).where(eq(s.settings.id, 1)).run();
    return null;
  });
}

/* ─────────────────────────── saved views ─────────────────────────── */

/** Backfill: fetch icons for every company with a website and no logo, a few at a time. */
export async function fetchMissingLogos() {
  return run(async () => {
    const db = getDb();
    const queue = companiesMissingLogos(db);
    let found = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (let id = queue.shift(); id !== undefined; id = queue.shift()) if (await fillCompanyLogo(db, id)) found++;
      }),
    );
    return { found, total: companiesMissingLogos(db).length + found };
  });
}

/* ─────────────────────────── background image ─────────────────────────── */

const BACKGROUND_DIR = path.join(UPLOAD_DIR, "backgrounds");

export async function uploadBackground(formData: FormData) {
  return run(async () => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Pick an image");
    const ext = path.extname(file.name).toLowerCase();
    if (!BACKGROUND_TYPES[ext]) throw new Error("Use a JPG, PNG, WebP, AVIF or GIF image");
    if (file.size > MAX_UPLOAD) throw new Error("Images must be under 10 MB");
    await fs.mkdir(BACKGROUND_DIR, { recursive: true });
    const stored = `${randomUUID()}${ext}`;
    await fs.writeFile(path.join(BACKGROUND_DIR, stored), Buffer.from(await file.arrayBuffer()));
    const previous = getDb().select({ image: s.settings.backgroundImage }).from(s.settings).where(eq(s.settings.id, 1)).get()?.image;
    getDb().update(s.settings).set({ backgroundImage: stored }).where(eq(s.settings.id, 1)).run();
    if (previous) await fs.rm(path.join(BACKGROUND_DIR, path.basename(previous)), { force: true });
    return { url: `${BACKGROUND_ROUTE}${stored}` };
  });
}

export async function removeBackground() {
  return run(async () => {
    const previous = getDb().select({ image: s.settings.backgroundImage }).from(s.settings).where(eq(s.settings.id, 1)).get()?.image;
    getDb().update(s.settings).set({ backgroundImage: null }).where(eq(s.settings.id, 1)).run();
    if (previous) await fs.rm(path.join(BACKGROUND_DIR, path.basename(previous)), { force: true });
    return null;
  });
}

export async function saveBackgroundStyle(input: unknown) {
  return run(
    () => {
      const { blur, dim, surface } = backgroundStyleSchema.parse(input);
      getDb().update(s.settings).set({ backgroundBlur: blur, backgroundDim: dim, surfaceOpacity: surface }).where(eq(s.settings.id, 1)).run();
      return null;
    },
    // The sliders already applied the change live; don't re-render under the cursor.
    { revalidate: false },
  );
}

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

/* ─────────────────────────── documents (CVs & cover letters) ─────────────────────────── */

const MAX_UPLOAD = 10 * 1024 * 1024;
const ALLOWED = new Set([".pdf", ".doc", ".docx", ".md", ".txt"]);

export async function saveResume(formData: FormData, id?: number) {
  return run(async () => {
    const { source, ...values } = resumeSchema.parse({
      kind: formData.get("kind") ?? undefined,
      name: formData.get("name"),
      description: formData.get("description"),
      source: formData.get("source") ?? undefined,
      fileUrl: formData.get("fileUrl"),
      content: formData.get("content"),
    });
    let filePath: string | undefined;
    const file = formData.get("file");
    if (source === "file" && file instanceof File && file.size > 0) {
      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED.has(ext)) throw new Error("Upload a PDF, Word, Markdown or text file");
      if (file.size > MAX_UPLOAD) throw new Error("Files must be under 10 MB");
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      // Random name on disk; the original name is kept for downloads.
      const stored = `${randomUUID()}${ext}`;
      await fs.writeFile(path.join(UPLOAD_DIR, stored), Buffer.from(await file.arrayBuffer()));
      filePath = `${stored}|${file.name.replace(/[^\w.\- ]+/g, "_")}`;
    }
    // Keep only the chosen source. Editing a file-backed document without a new upload keeps its file.
    const sourced = {
      ...values,
      fileUrl: source === "link" ? values.fileUrl : null,
      content: source === "write" ? values.content : null,
      ...(source === "file" ? (filePath ? { filePath } : {}) : { filePath: null }),
    };
    const db = getDb();
    const row = id
      ? db
          .update(s.resumeVersions)
          .set(sourced)
          .where(eq(s.resumeVersions.id, id))
          .returning()
          .get()
      : db.insert(s.resumeVersions).values(sourced).returning().get();
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
