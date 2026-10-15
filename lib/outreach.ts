import type { ActivityOutcome, ActivityType, ContactType, Direction, Tier } from "./domain";

/*
 * Cold outreach as a tree: company → people → threads → follow-ups and
 * replies. Nothing here is stored; each person's stage is derived from
 * their activities, so logging stays the single source of truth.
 *
 * A connection request that was "replied" to means the invite was accepted.
 */

export type OutreachActivity = {
  id: number;
  at: number;
  type: ActivityType;
  direction: Direction;
  outcome: ActivityOutcome;
  subject: string | null;
  summary: string | null;
  parentActivityId: number | null;
  followUpDueAt: number | null;
  companyId: number | null;
  contactId: number;
  opportunityId: number | null;
};

/** A message that started a thread, with its follow-ups and replies, oldest first. */
export type OutreachThread = { root: OutreachActivity; children: OutreachActivity[] };

export const OUTREACH_STAGES = ["new", "invited", "connected", "messaged", "replied", "talking"] as const;
export type OutreachStage = (typeof OUTREACH_STAGES)[number];

export type NextAction = "reach_out" | "follow_up" | "send_message" | null;

export type OutreachPerson = {
  id: number;
  name: string;
  role: string | null;
  contactType: ContactType | null;
  linkedinUrl: string | null;
  email: string | null;
  threads: OutreachThread[];
  stage: OutreachStage;
  next: NextAction;
  /** Earliest pending follow-up reminder, due or not. */
  followUpDueAt: number | null;
  lastAt: number | null;
};

export type OutreachCompany = {
  id: number;
  name: string;
  logoUrl: string | null;
  tier: Tier;
  people: OutreachPerson[];
};

const MESSAGE_TYPES: readonly ActivityType[] = ["cold_email", "linkedin_dm", "follow_up", "referral_request"];
const CONVERSATION_TYPES: readonly ActivityType[] = ["call", "coffee_chat", "interview"];
const ANSWERED: readonly ActivityOutcome[] = ["replied", "positive", "negative"];

export const isAccepted = (t: OutreachThread) => t.root.type === "linkedin_connection" && ANSWERED.includes(t.root.outcome);

/** Group activities into threads by their root, newest thread first. */
export function buildThreads(activities: OutreachActivity[]): OutreachThread[] {
  const ids = new Set(activities.map((a) => a.id));
  const byRoot = new Map<number, OutreachThread>();
  const sorted = [...activities].sort((a, b) => a.at - b.at);
  for (const a of sorted) {
    if (!a.parentActivityId || !ids.has(a.parentActivityId)) byRoot.set(a.id, { root: a, children: [] });
  }
  for (const a of sorted) {
    if (a.parentActivityId && ids.has(a.parentActivityId)) byRoot.get(a.parentActivityId)?.children.push(a);
  }
  return [...byRoot.values()].sort((a, b) => lastAt(b) - lastAt(a));
}

const lastAt = (t: OutreachThread) => Math.max(t.root.at, ...t.children.map((c) => c.at));

export function personStage(allThreads: OutreachThread[]): OutreachStage {
  // Notes are about someone, not to them.
  const threads = allThreads.filter((t) => t.root.type !== "note");
  if (!threads.length) return "new";
  const all = threads.flatMap((t) => [t.root, ...t.children]);
  const talks = threads.filter((t) => t.root.type !== "linkedin_connection");
  if (all.some((a) => CONVERSATION_TYPES.includes(a.type)) || talks.some((t) => t.root.outcome === "positive")) return "talking";
  if (talks.some((t) => ANSWERED.includes(t.root.outcome) || t.children.some((c) => c.direction === "inbound"))) return "replied";
  if (talks.some((t) => t.root.direction === "outbound" && MESSAGE_TYPES.includes(t.root.type))) return "messaged";
  // An inbound connection request means they invited you: you're connected.
  if (threads.some((t) => isAccepted(t) || (t.root.type === "linkedin_connection" && t.root.direction === "inbound"))) return "connected";
  if (threads.some((t) => t.root.type === "linkedin_connection")) return "invited";
  return "messaged";
}

export function nextAction(stage: OutreachStage, followUpDueAt: number | null, now: number): NextAction {
  if (followUpDueAt !== null && followUpDueAt <= now) return "follow_up";
  if (stage === "new") return "reach_out";
  if (stage === "connected") return "send_message";
  return null;
}

type PersonRow = Omit<OutreachPerson, "threads" | "stage" | "next" | "followUpDueAt" | "lastAt">;

export function buildPerson(row: PersonRow, activities: OutreachActivity[], now: number): OutreachPerson {
  const threads = buildThreads(activities);
  const stage = personStage(threads);
  const dues = activities.filter((a) => a.followUpDueAt !== null && a.outcome === "pending").map((a) => a.followUpDueAt!);
  const followUpDueAt = dues.length ? Math.min(...dues) : null;
  return {
    ...row,
    threads,
    stage,
    next: nextAction(stage, followUpDueAt, now),
    followUpDueAt,
    lastAt: threads.length ? Math.max(...threads.map(lastAt)) : null,
  };
}

/** People who need you first, then the most recently active. */
export function sortPeople(people: OutreachPerson[]): OutreachPerson[] {
  return [...people].sort((a, b) => Number(!!b.next && b.next !== "reach_out") - Number(!!a.next && a.next !== "reach_out") || (b.lastAt ?? 0) - (a.lastAt ?? 0));
}

export function companySummary(c: OutreachCompany) {
  return {
    people: c.people.length,
    reached: c.people.filter((p) => p.stage !== "new").length,
    replied: c.people.filter((p) => p.stage === "replied" || p.stage === "talking").length,
    needsAction: c.people.filter((p) => p.next === "follow_up" || p.next === "send_message").length,
    lastAt: Math.max(0, ...c.people.map((p) => p.lastAt ?? 0)) || null,
  };
}
