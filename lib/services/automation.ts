import { and, desc, eq, inArray, isNull, lt, max, or, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import * as s from "@/db/schema";
import {
  ACTIVE_STATUSES,
  canTransition,
  isTerminal,
  pipelineIndex,
  type ActivityType,
  type Channel,
  type OpportunityStatus,
} from "@/lib/domain";
import type { ActivityValues, InterviewValues } from "@/lib/validators";

/**
 * Business rules for the pipeline. Pure functions of (db, input) so the
 * server actions stay thin and everything here is unit-testable against
 * an in-memory database.
 */

export class DomainError extends Error {}

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0] | DB;

const DAY = 86_400_000;

export function defaultChannel(type: ActivityType): Channel {
  switch (type) {
    case "cold_email":
    case "referral_request":
      return "email";
    case "linkedin_connection":
    case "linkedin_dm":
      return "linkedin";
    case "application":
      return "company_site";
    case "call":
      return "phone";
    default:
      return "other";
  }
}

/* ───────────────────────────── status ───────────────────────────── */

export function changeStatus(
  db: Tx,
  opportunityId: number,
  to: OpportunityStatus,
  opts: { at?: Date; reason?: string | null } = {},
) {
  const at = opts.at ?? new Date();
  const opp = db.select().from(s.opportunities).where(eq(s.opportunities.id, opportunityId)).get();
  if (!opp) throw new DomainError("Opportunity not found");
  const from = opp.status;
  if (from === to) return { from, to, changed: false };
  if (!canTransition(from, to)) {
    throw new DomainError(`Can't move from ${from} to ${to}`);
  }
  const [{ top }] = db
    .select({ top: max(s.opportunities.position) })
    .from(s.opportunities)
    .where(eq(s.opportunities.status, to))
    .all();

  db.update(s.opportunities)
    .set({
      status: to,
      position: (top ?? -1) + 1,
      appliedAt: to === "applied" && !opp.appliedAt ? at : opp.appliedAt,
      rejectedAtStage: to === "rejected" ? from : opp.rejectedAtStage,
      rejectionReason: to === "rejected" && opts.reason ? opts.reason : opp.rejectionReason,
    })
    .where(eq(s.opportunities.id, opportunityId))
    .run();
  // History of a sample opportunity stays sample data (keeps analytics' seed exclusion honest).
  db.insert(s.statusHistory).values({ opportunityId, fromStatus: from, toStatus: to, changedAt: at, isSeed: opp.isSeed }).run();
  return { from, to, changed: true };
}

/**
 * Move forward to `target` only if the opportunity is earlier in the
 * pipeline. Walks through Applied when coming from Wishlist, since the
 * transition map doesn't allow skipping it.
 */
export function advanceTo(db: Tx, opportunityId: number, target: OpportunityStatus, at = new Date()) {
  const opp = db.select().from(s.opportunities).where(eq(s.opportunities.id, opportunityId)).get();
  if (!opp) return null;
  const cur = opp.status;
  const curIdx = isTerminal(cur) ? -1 : pipelineIndex(cur);
  if (curIdx >= pipelineIndex(target)) return null;
  if (!canTransition(cur, target)) {
    if (cur === "wishlist" && canTransition("applied", target)) {
      changeStatus(db, opportunityId, "applied", { at });
    } else {
      return null;
    }
  }
  return changeStatus(db, opportunityId, target, { at });
}

/* ───────────────────────────── activities ───────────────────────────── */

type Rules = { followUpRules: s.Settings["followUpRules"] };

function touchContact(db: Tx, contactId: number | null, at: Date) {
  if (!contactId) return;
  db.update(s.contacts)
    .set({
      lastContactedAt: sql`max(coalesce(${s.contacts.lastContactedAt}, 0), ${at.getTime()})`,
    })
    .where(eq(s.contacts.id, contactId))
    .run();
}

/** Walk up parent links to the activity that started the thread. */
export function threadRoot(db: Tx, activityId: number): s.Activity {
  let current = db.select().from(s.activities).where(eq(s.activities.id, activityId)).get();
  if (!current) throw new DomainError("Activity not found");
  for (let i = 0; current.parentActivityId && i < 20; i++) {
    const parent = db.select().from(s.activities).where(eq(s.activities.id, current.parentActivityId)).get();
    if (!parent) break;
    current = parent;
  }
  return current;
}

export type LogResult = {
  activity: s.Activity;
  createdCompanyId?: number;
  createdContactId?: number;
  createdOpportunityId?: number;
  statusChange?: { from: OpportunityStatus; to: OpportunityStatus } | null;
};

export function logActivity(db: DB, input: ActivityValues, settings: Rules, now = new Date()): LogResult {
  return db.transaction((tx) => {
    const v = { ...input };
    const result: Omit<LogResult, "activity"> = {};
    const occurredAt = v.occurredAt ?? now;

    // Follow-ups and replies inherit the thread's context.
    let parent: s.Activity | undefined;
    if (v.parentActivityId) {
      parent = threadRoot(tx, v.parentActivityId);
      v.parentActivityId = parent.id;
      v.companyId ??= parent.companyId;
      v.contactId ??= parent.contactId;
      v.opportunityId ??= parent.opportunityId;
      v.channel ??= parent.channel;
    }

    if (!v.companyId && v.newCompanyName) {
      const [company] = tx.insert(s.companies).values({ name: v.newCompanyName }).returning().all();
      v.companyId = company.id;
      result.createdCompanyId = company.id;
    }
    if (!v.contactId && v.newContactName) {
      const [contact] = tx
        .insert(s.contacts)
        .values({ name: v.newContactName, companyId: v.companyId })
        .returning()
        .all();
      v.contactId = contact.id;
      result.createdContactId = contact.id;
    }

    // Rule: an application creates the opportunity or moves it to Applied.
    if (v.type === "application" && v.direction === "outbound") {
      if (v.opportunityId) {
        result.statusChange = advanceTo(tx, v.opportunityId, "applied", occurredAt);
        tx.update(s.opportunities)
          .set({ appliedAt: sql`coalesce(${s.opportunities.appliedAt}, ${occurredAt.getTime()})` })
          .where(eq(s.opportunities.id, v.opportunityId))
          .run();
      } else if (v.companyId) {
        const title = v.newOpportunityTitle ?? v.subject ?? "Application";
        const [opp] = tx
          .insert(s.opportunities)
          .values({ companyId: v.companyId, title, status: "applied", appliedAt: occurredAt, source: "company_website" })
          .returning()
          .all();
        tx.insert(s.statusHistory)
          .values({ opportunityId: opp.id, fromStatus: null, toStatus: "applied", changedAt: occurredAt })
          .run();
        v.opportunityId = opp.id;
        result.createdOpportunityId = opp.id;
      }
    }

    // Rule: an interview moves the opportunity to Interviewing if it's earlier.
    if (v.type === "interview" && v.opportunityId) {
      result.statusChange = advanceTo(tx, v.opportunityId, "interviewing", occurredAt);
    }

    const ruleDays =
      settings.followUpRules[v.type] ??
      (v.type === "follow_up" && parent ? settings.followUpRules[parent.type] : undefined);
    const outbound = v.direction === "outbound";

    const [activity] = tx
      .insert(s.activities)
      .values({
        type: v.type,
        channel: v.channel ?? defaultChannel(v.type),
        direction: v.direction,
        companyId: v.companyId,
        contactId: v.contactId,
        opportunityId: v.opportunityId,
        parentActivityId: v.parentActivityId,
        templateId: v.templateId,
        subject: v.subject,
        summary: v.summary,
        occurredAt,
        outcome: outbound ? v.outcome : "replied",
        followUpDueAt: outbound && ruleDays && v.outcome === "pending" ? new Date(occurredAt.getTime() + ruleDays * DAY) : null,
      })
      .returning()
      .all();

    if (parent) {
      if (outbound) {
        // The follow-up resolves the thread's pending reminders; its own due date takes over.
        tx.update(s.activities)
          .set({ followUpDueAt: null })
          .where(
            and(
              sql`(${s.activities.id} = ${parent.id} or ${s.activities.parentActivityId} = ${parent.id})`,
              sql`${s.activities.id} != ${activity.id}`,
            ),
          )
          .run();
      } else {
        closeThreadAsReplied(tx, parent.id, occurredAt, "replied");
      }
    }

    touchContact(tx, v.contactId ?? null, occurredAt);
    return { activity, ...result };
  });
}

function closeThreadAsReplied(db: Tx, rootId: number, at: Date, outcome: "replied" | "positive" | "negative") {
  db.update(s.activities)
    .set({
      outcome,
      repliedAt: sql`coalesce(${s.activities.repliedAt}, ${at.getTime()})`,
      followUpDueAt: null,
    })
    .where(eq(s.activities.id, rootId))
    .run();
  db.update(s.activities)
    .set({ outcome: "replied", followUpDueAt: null })
    .where(and(eq(s.activities.parentActivityId, rootId), eq(s.activities.direction, "outbound")))
    .run();
}

/**
 * Mark a thread as replied: records the inbound reply as its own activity
 * (so reply-rate and time-to-reply metrics see it), closes reminders, and
 * touches the contact. Returns whether the UI should *offer* to advance
 * Applied → Screening; it never does it silently.
 */
export function markReplied(
  db: DB,
  activityId: number,
  opts: { sentiment?: "replied" | "positive" | "negative"; at?: Date; summary?: string | null } = {},
) {
  const at = opts.at ?? new Date();
  const sentiment = opts.sentiment ?? "replied";
  return db.transaction((tx) => {
    const root = threadRoot(tx, activityId);
    const [reply] = tx
      .insert(s.activities)
      .values({
        type: root.type === "application" ? "note" : root.type,
        channel: root.channel,
        direction: "inbound",
        companyId: root.companyId,
        contactId: root.contactId,
        opportunityId: root.opportunityId,
        parentActivityId: root.id,
        summary: opts.summary ?? null,
        occurredAt: at,
        outcome: "replied",
        isSeed: root.isSeed,
      })
      .returning()
      .all();
    closeThreadAsReplied(tx, root.id, at, sentiment);
    touchContact(tx, root.contactId, at);

    let suggestAdvance: { opportunityId: number; title: string } | null = null;
    if (sentiment === "positive" && root.opportunityId) {
      const opp = tx.select().from(s.opportunities).where(eq(s.opportunities.id, root.opportunityId)).get();
      if (opp?.status === "applied") suggestAdvance = { opportunityId: opp.id, title: opp.title };
    }
    return { reply, rootId: root.id, suggestAdvance };
  });
}

export function snoozeFollowUp(db: DB, activityId: number, days: number, now = new Date()) {
  const row = db.select().from(s.activities).where(eq(s.activities.id, activityId)).get();
  if (!row) throw new DomainError("Activity not found");
  const base = Math.max(now.getTime(), row.followUpDueAt?.getTime() ?? 0);
  const due = new Date(base + days * DAY);
  db.update(s.activities).set({ followUpDueAt: due }).where(eq(s.activities.id, activityId)).run();
  return { previous: row.followUpDueAt, due };
}

export function dismissFollowUp(db: DB, activityId: number) {
  db.update(s.activities).set({ followUpDueAt: null }).where(eq(s.activities.id, activityId)).run();
}

/* ───────────────────────────── interviews ───────────────────────────── */

export function saveInterview(db: DB, values: InterviewValues, id?: number) {
  return db.transaction((tx) => {
    const { interviewerIds, ...data } = values;
    let interview: s.Interview;
    if (id) {
      [interview] = tx.update(s.interviews).set(data).where(eq(s.interviews.id, id)).returning().all();
      tx.delete(s.interviewContacts).where(eq(s.interviewContacts.interviewId, id)).run();
    } else {
      [interview] = tx.insert(s.interviews).values(data).returning().all();
    }
    for (const contactId of interviewerIds) {
      tx.insert(s.interviewContacts).values({ interviewId: interview.id, contactId }).onConflictDoNothing().run();
    }
    // Rule: scheduling an interview moves the opportunity to Interviewing.
    const statusChange = advanceTo(tx, values.opportunityId, "interviewing", new Date());
    return { interview, statusChange };
  });
}

/* ───────────────────────────── ghosting ───────────────────────────── */

/**
 * Runs on dashboard load (no cron). Outreach threads with no reply after
 * `thresholdDays` become `no_response`; Applied/Screening opportunities
 * with no activity, status change or interview in that window become
 * Ghosted.
 */
export function runGhosting(db: DB, now: Date, thresholdDays: number) {
  const cutoff = new Date(now.getTime() - thresholdDays * DAY);
  return db.transaction((tx) => {
    const staleThreads = tx
      .select({ id: s.activities.id })
      .from(s.activities)
      .where(
        and(
          isNull(s.activities.deletedAt),
          eq(s.activities.direction, "outbound"),
          isNull(s.activities.parentActivityId),
          eq(s.activities.outcome, "pending"),
          lt(s.activities.occurredAt, cutoff),
          sql`not exists (select 1 from activities c where c.parent_activity_id = ${s.activities.id} and c.direction = 'inbound' and c.deleted_at is null)`,
          // A recent follow-up keeps the thread alive.
          sql`not exists (select 1 from activities c where c.parent_activity_id = ${s.activities.id} and c.occurred_at >= ${cutoff.getTime()} and c.deleted_at is null)`,
        ),
      )
      .all()
      .map((r) => r.id);

    if (staleThreads.length) {
      tx.update(s.activities)
        .set({ outcome: "no_response", followUpDueAt: null })
        .where(
          or(
            inArray(s.activities.id, staleThreads),
            and(inArray(s.activities.parentActivityId, staleThreads), eq(s.activities.direction, "outbound")),
          ),
        )
        .run();
    }

    const candidates = tx
      .select({ id: s.opportunities.id })
      .from(s.opportunities)
      .where(
        and(
          isNull(s.opportunities.deletedAt),
          inArray(s.opportunities.status, ["applied", "screening"]),
          sql`coalesce((select max(changed_at) from status_history h where h.opportunity_id = ${s.opportunities.id}), ${s.opportunities.createdAt}) < ${cutoff.getTime()}`,
          sql`coalesce((select max(occurred_at) from activities a where a.opportunity_id = ${s.opportunities.id} and a.deleted_at is null), 0) < ${cutoff.getTime()}`,
          sql`coalesce((select max(scheduled_at) from interviews i where i.opportunity_id = ${s.opportunities.id} and i.deleted_at is null), 0) < ${cutoff.getTime()}`,
        ),
      )
      .all();
    for (const { id } of candidates) changeStatus(tx, id, "ghosted", { at: now });

    return { threads: staleThreads.length, opportunities: candidates.length };
  });
}

/* ───────────────────────────── tags ───────────────────────────── */

export function ensureTags(db: Tx, names: string[]) {
  const ids: number[] = [];
  for (const name of names) {
    const existing = db.select().from(s.tags).where(eq(s.tags.name, name)).get();
    if (existing) {
      if (existing.deletedAt) db.update(s.tags).set({ deletedAt: null }).where(eq(s.tags.id, existing.id)).run();
      ids.push(existing.id);
    } else {
      ids.push(db.insert(s.tags).values({ name }).returning().get().id);
    }
  }
  return ids;
}

export function setCompanyTags(db: Tx, companyId: number, names: string[]) {
  const ids = ensureTags(db, names);
  db.delete(s.companyTags).where(eq(s.companyTags.companyId, companyId)).run();
  for (const tagId of ids) db.insert(s.companyTags).values({ companyId, tagId }).onConflictDoNothing().run();
}

export function setOpportunityTags(db: Tx, opportunityId: number, names: string[]) {
  const ids = ensureTags(db, names);
  db.delete(s.opportunityTags).where(eq(s.opportunityTags.opportunityId, opportunityId)).run();
  for (const tagId of ids) db.insert(s.opportunityTags).values({ opportunityId, tagId }).onConflictDoNothing().run();
}

export function addTagToCompanies(db: Tx, companyIds: number[], name: string) {
  const [tagId] = ensureTags(db, [name]);
  for (const companyId of companyIds) db.insert(s.companyTags).values({ companyId, tagId }).onConflictDoNothing().run();
}

export function addTagToOpportunities(db: Tx, opportunityIds: number[], name: string) {
  const [tagId] = ensureTags(db, [name]);
  for (const opportunityId of opportunityIds)
    db.insert(s.opportunityTags).values({ opportunityId, tagId }).onConflictDoNothing().run();
}

/* ───────────────────────────── kanban ───────────────────────────── */

/**
 * Persist a column's order after a drag. If the card changed column, the
 * status change goes through `changeStatus` (validation + history).
 */
export function moveCard(db: DB, opportunityId: number, to: OpportunityStatus, orderedIds: number[]) {
  return db.transaction((tx) => {
    const opp = tx.select().from(s.opportunities).where(eq(s.opportunities.id, opportunityId)).get();
    if (!opp) throw new DomainError("Opportunity not found");
    const statusChange = opp.status !== to ? changeStatus(tx, opportunityId, to) : null;
    orderedIds.forEach((id, position) => {
      tx.update(s.opportunities).set({ position }).where(eq(s.opportunities.id, id)).run();
    });
    return { statusChange };
  });
}

export function latestStatusChange(db: Tx, opportunityId: number) {
  return db
    .select()
    .from(s.statusHistory)
    .where(eq(s.statusHistory.opportunityId, opportunityId))
    .orderBy(desc(s.statusHistory.changedAt))
    .get();
}

export { ACTIVE_STATUSES };
