"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import {
  addTagToCompanies,
  addTagToOpportunities,
  changeStatus,
  recordApplication,
  setCompanyTags,
  setOpportunityTags,
} from "@/lib/services/automation";
import { findSameRole, findSimilarCompanies, recentMessageToContact } from "@/lib/services/duplicates";
import {
  companySchema,
  contactSchema,
  idSchema,
  idsSchema,
  opportunitySchema,
  type CompanyInput,
  type ContactInput,
  type OpportunityInput,
} from "@/lib/validators";
import { OPPORTUNITY_STATUSES } from "@/lib/domain";
import { LOGO_ROUTE, refreshCompanyLogo } from "@/lib/services/favicon";
import { run } from "./run";

/* ─────────────────────────── companies ─────────────────────────── */

export async function saveCompany(input: CompanyInput, id?: number) {
  return run(() => {
    const { tags, ...values } = companySchema.parse(input);
    const db = getDb();
    const previousWebsite = id ? db.select({ website: s.companies.website }).from(s.companies).where(eq(s.companies.id, id)).get()?.website : null;
    const row = db.transaction((tx) => {
      const row = id
        ? tx.update(s.companies).set(values).where(eq(s.companies.id, id)).returning().get()
        : tx.insert(s.companies).values(values).returning().get();
      setCompanyTags(tx, row.id, tags);
      return row;
    });
    // Fetch the site's icon in the background; it shows up on the next page load.
    if (row.website && (!row.logoUrl || (row.website !== previousWebsite && row.logoUrl.startsWith(LOGO_ROUTE)))) {
      after(() => refreshCompanyLogo(getDb(), row.id));
    }
    return { id: row.id, name: row.name };
  });
}

export async function checkCompanyDuplicates(name: string, excludeId?: number) {
  return run(() => findSimilarCompanies(getDb(), z.string().max(200).parse(name), excludeId), { revalidate: false });
}

/* ─────────────────────────── contacts ─────────────────────────── */

export async function saveContact(input: ContactInput, id?: number) {
  return run(() => {
    const values = contactSchema.parse(input);
    const db = getDb();
    const row = id
      ? db.update(s.contacts).set(values).where(eq(s.contacts.id, id)).returning().get()
      : db.insert(s.contacts).values(values).returning().get();
    return { id: row.id, name: row.name };
  });
}

export async function checkRecentMessage(contactId: number) {
  return run(() => recentMessageToContact(getDb(), idSchema.parse(contactId)), { revalidate: false });
}

/* ─────────────────────────── opportunities ─────────────────────────── */

export async function saveOpportunity(input: OpportunityInput, id?: number) {
  return run(() => {
    const { tags, contactIds, status, ...values } = opportunitySchema.parse(input);
    const db = getDb();
    return db.transaction((tx) => {
      let row: s.Opportunity;
      if (id) {
        row = tx.update(s.opportunities).set(values).where(eq(s.opportunities.id, id)).returning().get();
        // Status changes always go through the rules + history.
        if (row.status !== status) changeStatus(tx, id, status, { reason: values.rejectionReason });
      } else {
        row = tx
          .insert(s.opportunities)
          .values({ ...values, status, appliedAt: status === "wishlist" ? null : new Date() })
          .returning()
          .get();
        tx.insert(s.statusHistory).values({ opportunityId: row.id, fromStatus: null, toStatus: status }).run();
        if (row.appliedAt) recordApplication(tx, row, row.appliedAt);
      }
      setOpportunityTags(tx, row.id, tags);
      tx.delete(s.opportunityContacts).where(eq(s.opportunityContacts.opportunityId, row.id)).run();
      for (const contactId of new Set([...contactIds, ...(values.referredByContactId ? [values.referredByContactId] : [])])) {
        tx.insert(s.opportunityContacts).values({ opportunityId: row.id, contactId }).onConflictDoNothing().run();
      }
      return { id: row.id, title: row.title };
    });
  });
}

export async function checkRoleDuplicates(companyId: number, title: string, excludeId?: number) {
  return run(() => findSameRole(getDb(), idSchema.parse(companyId), z.string().max(200).parse(title), excludeId), {
    revalidate: false,
  });
}

export async function setOpportunityStatus(ids: number[], status: string, reason?: string) {
  return run(() => {
    const target = z.enum(OPPORTUNITY_STATUSES).parse(status);
    const db = getDb();
    const failed: string[] = [];
    let changed = 0;
    db.transaction((tx) => {
      for (const id of idsSchema.parse(ids)) {
        try {
          if (changeStatus(tx, id, target, { reason }).changed) changed++;
        } catch (e) {
          failed.push(e instanceof Error ? e.message : String(e));
        }
      }
    });
    return { changed, skipped: failed.length, reason: failed[0] };
  });
}

/* ─────────────────────────── bulk: tags / delete / restore ─────────────────────────── */

export async function addTag(entity: "companies" | "opportunities", ids: number[], tag: string) {
  return run(() => {
    const name = z.string().trim().min(1).max(40).parse(tag).toLowerCase();
    const db = getDb();
    db.transaction((tx) =>
      entity === "companies" ? addTagToCompanies(tx, idsSchema.parse(ids), name) : addTagToOpportunities(tx, idsSchema.parse(ids), name),
    );
    return { name };
  });
}

const TABLES = {
  companies: s.companies,
  contacts: s.contacts,
  opportunities: s.opportunities,
  activities: s.activities,
  interviews: s.interviews,
  templates: s.templates,
  resumes: s.resumeVersions,
  views: s.savedViews,
} as const;
export type SoftDeletable = keyof typeof TABLES;
const entitySchema = z.enum(Object.keys(TABLES) as [SoftDeletable, ...SoftDeletable[]]);

/** Soft delete. The toast's Undo calls `restoreRecords` with the same ids. */
export async function deleteRecords(entity: SoftDeletable, ids: number[]) {
  return run(() => {
    const table = TABLES[entitySchema.parse(entity)];
    const valid = idsSchema.parse(ids);
    getDb()
      .update(table)
      .set({ deletedAt: new Date() })
      .where(and(inArray(table.id, valid), isNull(table.deletedAt)))
      .run();
    return { ids: valid };
  });
}

export async function restoreRecords(entity: SoftDeletable, ids: number[]) {
  return run(() => {
    const table = TABLES[entitySchema.parse(entity)];
    getDb().update(table).set({ deletedAt: null }).where(inArray(table.id, idsSchema.parse(ids))).run();
    return null;
  });
}
