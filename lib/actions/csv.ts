"use server";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, type DB } from "@/db/client";
import * as s from "@/db/schema";
import { CSV_FIELDS, coerceEnum } from "@/lib/csv-fields";
import { changeStatus, defaultChannel, setCompanyTags, setOpportunityTags } from "@/lib/services/automation";
import { activitySchema, companySchema, contactSchema, opportunitySchema } from "@/lib/validators";
import { run } from "./run";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
const entitySchema = z.enum(["companies", "contacts", "opportunities", "activities"]);
const rowsSchema = z.array(z.record(z.string(), z.string())).max(5000, "Import at most 5,000 rows at a time");

function companyByName(tx: Tx, name: string, cache: Map<string, number>) {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;
  const found = tx
    .select({ id: s.companies.id })
    .from(s.companies)
    .where(sql`lower(${s.companies.name}) = ${key} and ${s.companies.deletedAt} is null`)
    .get();
  const id = found?.id ?? tx.insert(s.companies).values({ name: name.trim() }).returning().get().id;
  cache.set(key, id);
  return id;
}

function contactByName(tx: Tx, name: string, companyId: number | null) {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  const found = tx
    .select({ id: s.contacts.id })
    .from(s.contacts)
    .where(sql`lower(${s.contacts.name}) = ${key} and ${s.contacts.deletedAt} is null`)
    .get();
  return found?.id ?? tx.insert(s.contacts).values({ name: name.trim(), companyId }).returning().get().id;
}

const list = (v?: string) =>
  (v ?? "")
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean);

/**
 * Rows arrive already mapped to field keys by the client. Each row is
 * validated with the same zod schema the forms use; valid rows are
 * inserted together and invalid ones reported by line number.
 */
export async function importCsv(entity: string, input: Record<string, string>[]) {
  return run(() => {
    const kind = entitySchema.parse(entity);
    const rows = rowsSchema.parse(input);
    const fields = CSV_FIELDS[kind];
    const errors: { row: number; message: string }[] = [];
    let inserted = 0;
    const cache = new Map<string, number>();

    getDb().transaction((tx) => {
      rows.forEach((raw, index) => {
        const row: Record<string, string> = {};
        for (const f of fields) {
          const v = raw[f.key]?.trim() ?? "";
          row[f.key] = f.enum ? coerceEnum(v, f.enum) : v;
        }
        // Each row gets a savepoint so a failure halfway through leaves nothing behind.
        tx.run(sql`savepoint csv_row`);
        try {
          if (kind === "companies") {
            const { tags, ...values } = companySchema.parse({
              ...row,
              techStack: list(row.techStack),
              tags: list(row.tags),
              tier: row.tier || undefined,
            });
            const id = tx.insert(s.companies).values(values).returning().get().id;
            setCompanyTags(tx, id, tags);
          } else if (kind === "contacts") {
            const companyId = row.companyName ? companyByName(tx, row.companyName, cache) : null;
            tx.insert(s.contacts).values(contactSchema.parse({ ...row, companyId })).run();
          } else if (kind === "opportunities") {
            const companyId = companyByName(tx, row.companyName, cache);
            const { tags, contactIds: _c, status, ...values } = opportunitySchema.parse({
              ...row,
              companyId,
              status: row.status || undefined,
              employmentType: row.employmentType || undefined,
              priority: row.priority || undefined,
              excitement: row.excitement || undefined,
              tags: list(row.tags),
            });
            void _c;
            const id = tx.insert(s.opportunities).values({ ...values, status: "wishlist" }).returning().get().id;
            tx.insert(s.statusHistory).values({ opportunityId: id, fromStatus: null, toStatus: "wishlist" }).run();
            if (status !== "wishlist") {
              // Walk through Applied when needed so history stays valid.
              // Imported rows are history, not today's work: keep them out of goals and streaks.
              if (status !== "applied" && status !== "withdrawn") changeStatus(tx, id, "applied", { logApplication: false });
              changeStatus(tx, id, status, { logApplication: false });
            }
            setOpportunityTags(tx, id, tags);
          } else {
            const companyId = row.companyName ? companyByName(tx, row.companyName, cache) : null;
            const contactId = row.contactName ? contactByName(tx, row.contactName, companyId) : null;
            const v = activitySchema.parse({
              ...row,
              companyId,
              contactId,
              channel: row.channel || undefined,
              direction: row.direction || undefined,
              outcome: row.outcome || undefined,
            });
            tx.insert(s.activities)
              .values({
                type: v.type,
                channel: v.channel ?? defaultChannel(v.type),
                direction: v.direction,
                companyId: v.companyId,
                contactId: v.contactId,
                subject: v.subject,
                summary: v.summary,
                occurredAt: v.occurredAt ?? new Date(),
                outcome: v.outcome,
              })
              .run();
            if (contactId && v.occurredAt) {
              tx.update(s.contacts)
                .set({ lastContactedAt: sql`max(coalesce(${s.contacts.lastContactedAt}, 0), ${v.occurredAt.getTime()})` })
                .where(eq(s.contacts.id, contactId))
                .run();
            }
          }
          tx.run(sql`release csv_row`);
          inserted++;
        } catch (e) {
          tx.run(sql`rollback to csv_row`);
          tx.run(sql`release csv_row`);
          const message =
            e instanceof z.ZodError
              ? e.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`).join("; ")
              : e instanceof Error
                ? e.message
                : String(e);
          errors.push({ row: index + 2, message }); // +2: header line and 1-based
        }
      });
    });
    return { inserted, errors: errors.slice(0, 50), failed: errors.length };
  });
}
