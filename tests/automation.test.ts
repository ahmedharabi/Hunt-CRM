import { beforeEach, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import * as s from "@/db/schema";
import type { DB } from "@/db/client";
import {
  advanceTo,
  changeStatus,
  DomainError,
  logActivity,
  markReplied,
  moveCard,
  runGhosting,
  saveInterview,
  snoozeFollowUp,
} from "@/lib/services/automation";
import { findSameRole, findSimilarCompanies, isSimilarName, recentMessageToContact } from "@/lib/services/duplicates";
import { activitySchema, interviewSchema, settingsSchema } from "@/lib/validators";
import { DEFAULT_FOLLOW_UP_RULES } from "@/lib/domain";
import { testDb } from "./helpers";

const DAY = 86_400_000;
const NOW = new Date("2026-09-24T09:00:00Z");
const rules = { followUpRules: DEFAULT_FOLLOW_UP_RULES };

let db: DB;
let companyId: number;
let contactId: number;

beforeEach(() => {
  db = testDb();
  companyId = db.insert(s.companies).values({ name: "Grafana Labs" }).returning().get().id;
  contactId = db.insert(s.contacts).values({ name: "Sarah", companyId }).returning().get().id;
});

const log = (input: Record<string, unknown>, now = NOW) =>
  logActivity(db, activitySchema.parse({ occurredAt: now, ...input }), rules, now);

const history = (opportunityId: number) =>
  db
    .select()
    .from(s.statusHistory)
    .where(eq(s.statusHistory.opportunityId, opportunityId))
    .orderBy(asc(s.statusHistory.id))
    .all()
    .map((h) => `${h.fromStatus ?? "∅"}→${h.toStatus}`);

describe("status changes", () => {
  it("writes history, sets applied_at and rejected_at_stage", () => {
    const opp = db.insert(s.opportunities).values({ companyId, title: "SRE Intern" }).returning().get();
    changeStatus(db, opp.id, "applied", { at: NOW });
    changeStatus(db, opp.id, "screening");
    changeStatus(db, opp.id, "rejected", { reason: "Filled internally" });
    const row = db.select().from(s.opportunities).where(eq(s.opportunities.id, opp.id)).get()!;
    expect(row.appliedAt?.getTime()).toBe(NOW.getTime());
    expect(row.rejectedAtStage).toBe("screening");
    expect(row.rejectionReason).toBe("Filled internally");
    expect(history(opp.id)).toEqual(["wishlist→applied", "applied→screening", "screening→rejected"]);
  });

  it("rejects transitions that aren't allowed", () => {
    const opp = db.insert(s.opportunities).values({ companyId, title: "X" }).returning().get();
    expect(() => changeStatus(db, opp.id, "offer")).toThrow(DomainError);
    expect(history(opp.id)).toEqual([]);
  });

  it("advanceTo never moves backwards and walks through Applied", () => {
    const opp = db.insert(s.opportunities).values({ companyId, title: "X" }).returning().get();
    advanceTo(db, opp.id, "interviewing");
    expect(history(opp.id)).toEqual(["wishlist→applied", "applied→interviewing"]);
    expect(advanceTo(db, opp.id, "applied")).toBeNull();
  });

  it("manual changes can move to any status and still log the application", () => {
    const opp = db.insert(s.opportunities).values({ companyId, title: "X" }).returning().get();
    changeStatus(db, opp.id, "interviewing", { manual: true });
    changeStatus(db, opp.id, "screening", { manual: true });
    changeStatus(db, opp.id, "wishlist", { manual: true });
    expect(history(opp.id)).toEqual(["wishlist→applied", "applied→interviewing", "interviewing→screening", "screening→wishlist"]);
    expect(db.select().from(s.opportunities).where(eq(s.opportunities.id, opp.id)).get()!.appliedAt).not.toBeNull();
  });

  it("moveCard changes status and persists order", () => {
    const a = db.insert(s.opportunities).values({ companyId, title: "A", status: "applied" }).returning().get();
    const b = db.insert(s.opportunities).values({ companyId, title: "B", status: "screening" }).returning().get();
    moveCard(db, a.id, "screening", [a.id, b.id]);
    const rows = db.select().from(s.opportunities).orderBy(asc(s.opportunities.position)).all();
    expect(rows.map((r) => [r.title, r.status])).toEqual([
      ["A", "screening"],
      ["B", "screening"],
    ]);
    moveCard(db, a.id, "applied", [a.id]);
    expect(db.select().from(s.opportunities).where(eq(s.opportunities.id, a.id)).get()!.status).toBe("applied");
  });
});

describe("applications count toward goals and streaks", () => {
  const applications = (opportunityId: number) =>
    db
      .select()
      .from(s.activities)
      .where(eq(s.activities.opportunityId, opportunityId))
      .all()
      .filter((a) => a.type === "application" && a.direction === "outbound");

  it("moving to Applied outside quick-log records one application activity", () => {
    const opp = db.insert(s.opportunities).values({ companyId, title: "SRE Intern" }).returning().get();
    changeStatus(db, opp.id, "applied", { at: NOW });
    changeStatus(db, opp.id, "screening");
    const [a] = applications(opp.id);
    expect(applications(opp.id)).toHaveLength(1);
    expect(a).toMatchObject({ companyId, subject: "SRE Intern", channel: "company_site", outcome: "pending" });
    expect(a.occurredAt.getTime()).toBe(NOW.getTime());
    expect(a.followUpDueAt?.getTime()).toBe(NOW.getTime() + 10 * DAY);
  });

  it("quick-logging an application on a wishlist opportunity doesn't double count", () => {
    const opp = db.insert(s.opportunities).values({ companyId, title: "X" }).returning().get();
    log({ type: "application", companyId, opportunityId: opp.id });
    expect(applications(opp.id)).toHaveLength(1);
  });

  it("walking through Applied for an interview records the application too", () => {
    const opp = db.insert(s.opportunities).values({ companyId, title: "X" }).returning().get();
    advanceTo(db, opp.id, "interviewing", NOW);
    expect(applications(opp.id)).toHaveLength(1);
  });

  it("can be skipped for imported history", () => {
    const opp = db.insert(s.opportunities).values({ companyId, title: "X" }).returning().get();
    changeStatus(db, opp.id, "applied", { logApplication: false });
    expect(applications(opp.id)).toHaveLength(0);
  });
});

describe("logging activities", () => {
  it("sets follow_up_due_at from the rules and touches the contact", () => {
    const { activity } = log({ type: "cold_email", companyId, contactId });
    expect(activity.followUpDueAt?.getTime()).toBe(NOW.getTime() + 5 * DAY);
    expect(activity.channel).toBe("email");
    const contact = db.select().from(s.contacts).where(eq(s.contacts.id, contactId)).get()!;
    expect(contact.lastContactedAt?.getTime()).toBe(NOW.getTime());
  });

  it("an application without an opportunity creates one in Applied", () => {
    const r = log({ type: "application", companyId, newOpportunityTitle: "Platform Intern" });
    const opp = db.select().from(s.opportunities).where(eq(s.opportunities.id, r.createdOpportunityId!)).get()!;
    expect(opp).toMatchObject({ title: "Platform Intern", status: "applied" });
    expect(opp.appliedAt?.getTime()).toBe(NOW.getTime());
    expect(r.activity.opportunityId).toBe(opp.id);
    expect(history(opp.id)).toEqual(["∅→applied"]);
  });

  it("an application on a wishlist opportunity moves it to Applied", () => {
    const opp = db.insert(s.opportunities).values({ companyId, title: "X" }).returning().get();
    log({ type: "application", companyId, opportunityId: opp.id });
    const row = db.select().from(s.opportunities).where(eq(s.opportunities.id, opp.id)).get()!;
    expect(row.status).toBe("applied");
    expect(row.appliedAt).not.toBeNull();
  });

  it("an interview moves an earlier opportunity to Interviewing, not a later one", () => {
    const early = db.insert(s.opportunities).values({ companyId, title: "E", status: "screening" }).returning().get();
    const late = db.insert(s.opportunities).values({ companyId, title: "L", status: "offer" }).returning().get();
    log({ type: "interview", companyId, opportunityId: early.id });
    log({ type: "interview", companyId, opportunityId: late.id });
    expect(db.select().from(s.opportunities).where(eq(s.opportunities.id, early.id)).get()!.status).toBe("interviewing");
    expect(db.select().from(s.opportunities).where(eq(s.opportunities.id, late.id)).get()!.status).toBe("offer");
  });

  it("scheduling an interview also advances the opportunity", () => {
    const opp = db.insert(s.opportunities).values({ companyId, title: "X", status: "applied" }).returning().get();
    saveInterview(db, interviewSchema.parse({ opportunityId: opp.id, stage: "technical", scheduledAt: NOW, interviewerIds: [contactId] }));
    expect(db.select().from(s.opportunities).where(eq(s.opportunities.id, opp.id)).get()!.status).toBe("interviewing");
    expect(db.select().from(s.interviewContacts).all()).toHaveLength(1);
  });

  it("follow-ups inherit thread context and replace the parent's reminder", () => {
    const opp = db.insert(s.opportunities).values({ companyId, title: "X", status: "applied" }).returning().get();
    const { activity: root } = log({ type: "linkedin_dm", companyId, contactId, opportunityId: opp.id });
    const later = new Date(NOW.getTime() + 8 * DAY);
    const { activity: fu } = log({ type: "follow_up", parentActivityId: root.id }, later);
    expect(fu).toMatchObject({ companyId, contactId, opportunityId: opp.id, channel: "linkedin", parentActivityId: root.id });
    expect(fu.followUpDueAt?.getTime()).toBe(later.getTime() + 7 * DAY); // inherits the DM rule
    expect(db.select().from(s.activities).where(eq(s.activities.id, root.id)).get()!.followUpDueAt).toBeNull();
  });

  it("follow-ups of a follow-up still attach to the thread root", () => {
    const { activity: root } = log({ type: "cold_email", companyId });
    const { activity: fu1 } = log({ type: "follow_up", parentActivityId: root.id });
    const { activity: fu2 } = log({ type: "follow_up", parentActivityId: fu1.id });
    expect(fu2.parentActivityId).toBe(root.id);
  });

  it("creates company and contact inline", () => {
    const r = log({ type: "linkedin_connection", newCompanyName: "Koyeb", newContactName: "Yann" });
    const contact = db.select().from(s.contacts).where(eq(s.contacts.id, r.createdContactId!)).get()!;
    expect(contact.companyId).toBe(r.createdCompanyId);
  });

  it("saves the email and company website from a cold email", () => {
    const r = log({ type: "cold_email", newCompanyName: "Koyeb", contactEmail: "jobs@koyeb.com", companyWebsite: "koyeb.com" });
    const company = db.select().from(s.companies).where(eq(s.companies.id, r.createdCompanyId!)).get()!;
    const contact = db.select().from(s.contacts).where(eq(s.contacts.id, r.createdContactId!)).get()!;
    expect(company.website).toBe("https://koyeb.com");
    expect(contact).toMatchObject({ name: "jobs@koyeb.com", email: "jobs@koyeb.com", companyId: company.id });

    log({ type: "cold_email", companyId, contactId, contactEmail: "yann@acme.dev", companyWebsite: "https://acme.dev" });
    expect(db.select().from(s.contacts).where(eq(s.contacts.id, contactId)).get()!.email).toBe("yann@acme.dev");
    expect(db.select().from(s.companies).where(eq(s.companies.id, companyId)).get()!.website).toBe("https://acme.dev");
  });

  it("requires a company for outreach", () => {
    expect(() => activitySchema.parse({ type: "cold_email" })).toThrow(/company/i);
  });
});

describe("replies", () => {
  it("marking replied records an inbound reply and closes reminders", () => {
    const { activity: root } = log({ type: "cold_email", companyId, contactId });
    const { activity: fu } = log({ type: "follow_up", parentActivityId: root.id });
    const at = new Date(NOW.getTime() + 2 * DAY);
    const r = markReplied(db, fu.id, { sentiment: "replied", at });
    expect(r.rootId).toBe(root.id);
    const rows = db.select().from(s.activities).all();
    const rootRow = rows.find((a) => a.id === root.id)!;
    expect(rootRow).toMatchObject({ outcome: "replied", followUpDueAt: null });
    expect(rootRow.repliedAt?.getTime()).toBe(at.getTime());
    expect(rows.find((a) => a.id === fu.id)!.followUpDueAt).toBeNull();
    expect(rows.filter((a) => a.direction === "inbound" && a.parentActivityId === root.id)).toHaveLength(1);
  });

  it("suggests (but does not perform) Applied → Screening on a positive reply", () => {
    const opp = db.insert(s.opportunities).values({ companyId, title: "X", status: "applied" }).returning().get();
    const { activity } = log({ type: "application", companyId, opportunityId: opp.id });
    const r = markReplied(db, activity.id, { sentiment: "positive" });
    expect(r.suggestAdvance).toEqual({ opportunityId: opp.id, title: "X" });
    expect(db.select().from(s.opportunities).where(eq(s.opportunities.id, opp.id)).get()!.status).toBe("applied");
  });

  it("snooze pushes the due date from whichever is later: now or the current due date", () => {
    const { activity } = log({ type: "cold_email", companyId });
    const { due } = snoozeFollowUp(db, activity.id, 2, NOW);
    expect(due.getTime()).toBe(NOW.getTime() + 7 * DAY);
  });
});

describe("ghosting", () => {
  it("closes silent threads and ghosts stale Applied opportunities", () => {
    const old = new Date(NOW.getTime() - 30 * DAY);
    const opp = db.insert(s.opportunities).values({ companyId, title: "X", createdAt: old }).returning().get();
    const { activity: silent } = log({ type: "application", companyId, opportunityId: opp.id }, old);
    const { activity: answered } = log({ type: "cold_email", companyId }, old);
    markReplied(db, answered.id, { at: new Date(old.getTime() + DAY) });
    const { activity: fresh } = log({ type: "cold_email", companyId }, new Date(NOW.getTime() - 3 * DAY));

    const r = runGhosting(db, NOW, 21);
    expect(r).toEqual({ threads: 1, opportunities: 1 });
    const get = (id: number) => db.select().from(s.activities).where(eq(s.activities.id, id)).get()!;
    expect(get(silent.id).outcome).toBe("no_response");
    expect(get(answered.id).outcome).toBe("replied");
    expect(get(fresh.id).outcome).toBe("pending");
    expect(db.select().from(s.opportunities).where(eq(s.opportunities.id, opp.id)).get()!.status).toBe("ghosted");
    expect(runGhosting(db, NOW, 21)).toEqual({ threads: 0, opportunities: 0 });
  });

  it("a recent follow-up keeps a thread alive", () => {
    const old = new Date(NOW.getTime() - 30 * DAY);
    const { activity } = log({ type: "cold_email", companyId }, old);
    log({ type: "follow_up", parentActivityId: activity.id }, new Date(NOW.getTime() - 2 * DAY));
    expect(runGhosting(db, NOW, 21).threads).toBe(0);
  });
});

describe("duplicate guardrails", () => {
  it("matches company names fuzzily", () => {
    expect(isSimilarName("Grafana Labs", "grafana")).toBe(true);
    expect(isSimilarName("Fly.io", "fly io")).toBe(true);
    expect(isSimilarName("Datadog", "DataDog Inc.")).toBe(true);
    expect(isSimilarName("Kong", "Koyeb")).toBe(false);
    expect(findSimilarCompanies(db, "Grafana").map((c) => c.name)).toEqual(["Grafana Labs"]);
  });

  it("finds the same role at the same company", () => {
    db.insert(s.opportunities).values({ companyId, title: "Platform Engineering Intern" }).run();
    expect(findSameRole(db, companyId, "Platform Engineering Internship")).toHaveLength(1);
    expect(findSameRole(db, companyId, "Data Scientist")).toHaveLength(0);
  });

  it("flags a contact messaged within 7 days", () => {
    log({ type: "linkedin_dm", companyId, contactId }, new Date(NOW.getTime() - 3 * DAY));
    expect(recentMessageToContact(db, contactId, NOW)).not.toBeNull();
    expect(recentMessageToContact(db, contactId, new Date(NOW.getTime() + 10 * DAY))).toBeNull();
  });
});

describe("sample data stays sample data", () => {
  it("replies and status changes derived from seed rows inherit is_seed", () => {
    const opp = db.insert(s.opportunities).values({ companyId, title: "Seeded", status: "applied", isSeed: true }).returning().get();
    const root = db
      .insert(s.activities)
      .values({ type: "cold_email", direction: "outbound", companyId, opportunityId: opp.id, occurredAt: NOW, isSeed: true })
      .returning()
      .get();
    const r = markReplied(db, root.id, { at: NOW });
    expect(r.reply.isSeed).toBe(true);
    changeStatus(db, opp.id, "screening");
    expect(db.select().from(s.statusHistory).where(eq(s.statusHistory.opportunityId, opp.id)).get()!.isSeed).toBe(true);
  });
});

describe("settings", () => {
  it("accepts goal maps with zero-goal types left out", () => {
    const base = { timezone: "UTC", weekStartsOn: 1, ghostingThresholdDays: 21, linkedinWeeklyConnectionLimit: 100, streakMode: "any_goal" };
    const v = settingsSchema.parse({ ...base, dailyGoals: {}, weeklyGoals: { application: 5 }, followUpRules: {}, streakGoals: { application: 15, cold_email: 15 } });
    expect(v.dailyGoals).toEqual({});
    expect(v.weeklyGoals).toEqual({ application: 5 });
    expect(v.streakGoals).toEqual({ application: 15, cold_email: 15 });
  });
});
