"use server";

import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import {
  advanceTo,
  dismissFollowUp,
  logActivity as logActivityService,
  markReplied as markRepliedService,
  saveInterview as saveInterviewService,
  snoozeFollowUp,
} from "@/lib/services/automation";
import { ACTIVITY_OUTCOMES } from "@/lib/domain";
import { getLookups as getLookupsQuery } from "@/lib/queries/records";
import { getSettings } from "@/lib/queries/settings";
import { activitySchema, idSchema, idsSchema, interviewSchema, type ActivityInput, type InterviewInput } from "@/lib/validators";
import { run } from "./run";

export async function logActivity(input: ActivityInput) {
  return run(() => {
    const values = activitySchema.parse(input);
    const result = logActivityService(getDb(), values, getSettings());
    return {
      id: result.activity.id,
      createdCompanyId: result.createdCompanyId,
      createdContactId: result.createdContactId,
      createdOpportunityId: result.createdOpportunityId,
      statusChange: result.statusChange ?? null,
    };
  });
}

export async function updateActivity(id: number, input: ActivityInput) {
  return run(() => {
    const v = activitySchema.parse(input);
    getDb()
      .update(s.activities)
      .set({
        type: v.type,
        channel: v.channel ?? undefined,
        direction: v.direction,
        companyId: v.companyId,
        contactId: v.contactId,
        opportunityId: v.opportunityId,
        templateId: v.templateId,
        subject: v.subject,
        summary: v.summary,
        occurredAt: v.occurredAt ?? undefined,
        outcome: v.outcome,
      })
      .where(eq(s.activities.id, idSchema.parse(id)))
      .run();
    return null;
  });
}

const sentimentSchema = z.enum(["replied", "positive", "negative"]);

export async function markReplied(activityId: number, sentiment: "replied" | "positive" | "negative" = "replied", summary?: string) {
  return run(() => {
    const r = markRepliedService(getDb(), idSchema.parse(activityId), {
      sentiment: sentimentSchema.parse(sentiment),
      summary: z.string().max(5000).optional().parse(summary) ?? null,
    });
    return { rootId: r.rootId, replyId: r.reply.id, suggestAdvance: r.suggestAdvance };
  });
}

/** The quick confirm after a positive reply: Applied → Screening. */
export async function advanceToScreening(opportunityId: number) {
  return run(() => advanceTo(getDb(), idSchema.parse(opportunityId), "screening"));
}

export async function snooze(activityId: number, days = 2) {
  return run(() => {
    const r = snoozeFollowUp(getDb(), idSchema.parse(activityId), z.number().int().min(1).max(60).parse(days));
    return { due: r.due, previous: r.previous };
  });
}

/** Restores a previous due date (undo for snooze). */
export async function setFollowUpDue(activityId: number, due: Date | null) {
  return run(() => {
    getDb().update(s.activities).set({ followUpDueAt: due }).where(eq(s.activities.id, idSchema.parse(activityId))).run();
    return null;
  });
}

export async function dismiss(activityId: number) {
  return run(() => dismissFollowUp(getDb(), idSchema.parse(activityId)));
}

export async function setOutcome(ids: number[], outcome: string) {
  return run(() => {
    const value = z.enum(ACTIVITY_OUTCOMES).parse(outcome);
    getDb()
      .update(s.activities)
      .set({ outcome: value, ...(value !== "pending" ? { followUpDueAt: null } : {}) })
      .where(inArray(s.activities.id, idsSchema.parse(ids)))
      .run();
    return null;
  });
}

export async function saveInterview(input: InterviewInput, id?: number) {
  return run(() => {
    const r = saveInterviewService(getDb(), interviewSchema.parse(input), id);
    return { id: r.interview.id, statusChange: r.statusChange };
  });
}

export async function getLookups() {
  return run(() => getLookupsQuery(), { revalidate: false });
}
