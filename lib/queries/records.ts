import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import type {
  ActivityOutcome,
  ActivityType,
  Channel,
  CompanySize,
  ContactType,
  Direction,
  EmploymentType,
  InterviewStage,
  InterviewOutcome,
  OpportunitySource,
  OpportunityStatus,
  RemotePolicy,
  Tier,
} from "@/lib/domain";

/*
 * List queries return flat, serializable rows (timestamps as epoch ms)
 * with the aggregates the tables need, computed in SQL.
 */

const all = <T,>(sql: string, params: Record<string, unknown> = {}) =>
  getDb().$client.prepare(sql).all(params) as T[];

const splitTags = (v: string | null) => (v ? v.split("\u001f") : []);

/* ─────────────────────────── companies ─────────────────────────── */

export type CompanyRow = {
  id: number;
  name: string;
  website: string | null;
  linkedinUrl: string | null;
  logoUrl: string | null;
  industry: string | null;
  size: CompanySize | null;
  hqLocation: string | null;
  country: string | null;
  timezone: string | null;
  remotePolicy: RemotePolicy | null;
  techStack: string[];
  tier: Tier;
  tags: string[];
  contacts: number;
  opportunities: number;
  activeOpportunities: number;
  touchpoints: number;
  lastActivityAt: number | null;
  createdAt: number;
  isSeed: boolean;
};

export function listCompanies(): CompanyRow[] {
  const rows = all<Omit<CompanyRow, "techStack" | "tags" | "isSeed"> & { techStack: string; tags: string | null; isSeed: number }>(
    `select c.id, c.name, c.website, c.linkedin_url as linkedinUrl, c.logo_url as logoUrl, c.industry, c.size,
       c.hq_location as hqLocation, c.country, c.timezone, c.remote_policy as remotePolicy, c.tech_stack as techStack,
       c.tier, c.created_at as createdAt, c.is_seed as isSeed,
       (select group_concat(t.name, char(31)) from company_tags ct join tags t on t.id = ct.tag_id where ct.company_id = c.id) as tags,
       (select count(*) from contacts p where p.company_id = c.id and p.deleted_at is null) as contacts,
       (select count(*) from opportunities o where o.company_id = c.id and o.deleted_at is null) as opportunities,
       (select count(*) from opportunities o where o.company_id = c.id and o.deleted_at is null
          and o.status not in ('rejected','ghosted','withdrawn','accepted')) as activeOpportunities,
       (select count(*) from activities a where a.company_id = c.id and a.deleted_at is null and a.direction = 'outbound') as touchpoints,
       (select max(a.occurred_at) from activities a where a.company_id = c.id and a.deleted_at is null) as lastActivityAt
     from companies c where c.deleted_at is null
     order by c.name collate nocase`,
  );
  return rows.map((r) => ({ ...r, techStack: JSON.parse(r.techStack || "[]"), tags: splitTags(r.tags), isSeed: !!r.isSeed }));
}

/* ─────────────────────────── contacts ─────────────────────────── */

export type ContactRow = {
  id: number;
  name: string;
  role: string | null;
  contactType: ContactType | null;
  email: string | null;
  linkedinUrl: string | null;
  companyId: number | null;
  companyName: string | null;
  companyTier: Tier | null;
  lastContactedAt: number | null;
  touchpoints: number;
  replies: number;
  createdAt: number;
};

export function listContacts(): ContactRow[] {
  return all<ContactRow>(
    `select p.id, p.name, p.role, p.contact_type as contactType, p.email, p.linkedin_url as linkedinUrl,
       c.id as companyId, c.name as companyName, c.tier as companyTier,
       p.last_contacted_at as lastContactedAt, p.created_at as createdAt,
       (select count(*) from activities a where a.contact_id = p.id and a.deleted_at is null and a.direction = 'outbound') as touchpoints,
       (select count(*) from activities a where a.contact_id = p.id and a.deleted_at is null and a.direction = 'inbound') as replies
     from contacts p left join companies c on c.id = p.company_id and c.deleted_at is null
     where p.deleted_at is null
     order by p.name collate nocase`,
  );
}

/* ─────────────────────────── opportunities ─────────────────────────── */

export type OpportunityRow = {
  id: number;
  title: string;
  companyId: number;
  companyName: string;
  companyTier: Tier;
  companyLogo: string | null;
  status: OpportunityStatus;
  employmentType: EmploymentType;
  workMode: RemotePolicy | null;
  country: string | null;
  source: OpportunitySource | null;
  compensation: string | null;
  deadline: number | null;
  appliedAt: number | null;
  priority: number;
  excitement: number;
  jobUrl: string | null;
  resumeName: string | null;
  tags: string[];
  stageSince: number;
  position: number;
  nextInterviewAt: number | null;
  nextFollowUpAt: number | null;
  createdAt: number;
};

export function listOpportunities(): OpportunityRow[] {
  const rows = all<Omit<OpportunityRow, "tags"> & { tags: string | null }>(
    `select o.id, o.title, c.id as companyId, c.name as companyName, c.tier as companyTier, c.logo_url as companyLogo,
       o.status, o.employment_type as employmentType, o.work_mode as workMode, o.country, o.source, o.compensation,
       o.deadline, o.applied_at as appliedAt, o.priority, o.excitement, o.job_url as jobUrl, o.position, o.created_at as createdAt,
       r.name as resumeName,
       (select group_concat(t.name, char(31)) from opportunity_tags ot join tags t on t.id = ot.tag_id where ot.opportunity_id = o.id) as tags,
       coalesce((select max(h.changed_at) from status_history h where h.opportunity_id = o.id), o.created_at) as stageSince,
       (select min(i.scheduled_at) from interviews i where i.opportunity_id = o.id and i.deleted_at is null
          and i.outcome = 'scheduled' and i.scheduled_at >= (unixepoch() * 1000 - 7200000)) as nextInterviewAt,
       (select min(a.follow_up_due_at) from activities a where a.opportunity_id = o.id and a.deleted_at is null
          and a.outcome = 'pending' and a.follow_up_due_at is not null) as nextFollowUpAt
     from opportunities o
     join companies c on c.id = o.company_id and c.deleted_at is null
     left join resume_versions r on r.id = o.resume_version_id
     where o.deleted_at is null
     order by o.position, o.id`,
  );
  return rows.map((r) => ({ ...r, tags: splitTags(r.tags) }));
}

/* ─────────────────────────── activities ─────────────────────────── */

export type ActivityRow = {
  id: number;
  type: ActivityType;
  channel: Channel;
  direction: Direction;
  outcome: ActivityOutcome;
  subject: string | null;
  summary: string | null;
  occurredAt: number;
  repliedAt: number | null;
  followUpDueAt: number | null;
  parentActivityId: number | null;
  companyId: number | null;
  companyName: string | null;
  contactId: number | null;
  contactName: string | null;
  opportunityId: number | null;
  opportunityTitle: string | null;
  templateName: string | null;
  hasReply: number;
};

export function listActivities(): ActivityRow[] {
  return all<ActivityRow>(
    `select a.id, a.type, a.channel, a.direction, a.outcome, a.subject, a.summary,
       a.occurred_at as occurredAt, a.replied_at as repliedAt, a.follow_up_due_at as followUpDueAt,
       a.parent_activity_id as parentActivityId,
       c.id as companyId, c.name as companyName, p.id as contactId, p.name as contactName,
       o.id as opportunityId, o.title as opportunityTitle, t.name as templateName,
       exists(select 1 from activities r where r.parent_activity_id = coalesce(a.parent_activity_id, a.id)
         and r.direction = 'inbound' and r.deleted_at is null) as hasReply
     from activities a
     left join companies c on c.id = a.company_id
     left join contacts p on p.id = a.contact_id
     left join opportunities o on o.id = a.opportunity_id
     left join templates t on t.id = a.template_id
     where a.deleted_at is null
     order by a.occurred_at desc`,
  );
}

/* ─────────────────────────── timeline ─────────────────────────── */

export type TimelineItem =
  | {
      kind: "activity";
      id: number;
      at: number;
      type: ActivityType;
      direction: Direction;
      channel: Channel;
      outcome: ActivityOutcome;
      subject: string | null;
      summary: string | null;
      parentActivityId: number | null;
      followUpDueAt: number | null;
      contactId: number | null;
      contactName: string | null;
      opportunityId: number | null;
      opportunityTitle: string | null;
      companyId: number | null;
      companyName: string | null;
    }
  | {
      kind: "status";
      id: number;
      at: number;
      from: OpportunityStatus | null;
      to: OpportunityStatus;
      opportunityId: number;
      opportunityTitle: string;
    }
  | {
      kind: "interview";
      id: number;
      at: number;
      stage: InterviewStage;
      outcome: InterviewOutcome;
      durationMinutes: number;
      selfRating: number | null;
      opportunityId: number;
      opportunityTitle: string;
    };

type Scope = { companyId?: number; contactId?: number; opportunityId?: number };

export function getTimeline(scope: Scope): TimelineItem[] {
  const where = scope.companyId
    ? { a: "a.company_id = @id", o: "o.company_id = @id" }
    : scope.contactId
      ? { a: "a.contact_id = @id", o: "o.id in (select opportunity_id from opportunity_contacts where contact_id = @id)" }
      : { a: "a.opportunity_id = @id", o: "o.id = @id" };
  const id = scope.companyId ?? scope.contactId ?? scope.opportunityId;

  const acts = all<Omit<Extract<TimelineItem, { kind: "activity" }>, "kind">>(
    `select a.id, a.occurred_at as at, a.type, a.direction, a.channel, a.outcome, a.subject, a.summary,
       a.parent_activity_id as parentActivityId, a.follow_up_due_at as followUpDueAt,
       p.id as contactId, p.name as contactName, o.id as opportunityId, o.title as opportunityTitle,
       c.id as companyId, c.name as companyName
     from activities a left join contacts p on p.id = a.contact_id left join opportunities o on o.id = a.opportunity_id
       left join companies c on c.id = a.company_id
     where a.deleted_at is null and ${where.a}`,
    { id },
  ).map((r) => ({ kind: "activity" as const, ...r }));

  // Contacts don't own status changes; only show those that involve them.
  const statuses = all<Omit<Extract<TimelineItem, { kind: "status" }>, "kind">>(
    `select h.id, h.changed_at as at, h.from_status as "from", h.to_status as "to", o.id as opportunityId, o.title as opportunityTitle
     from status_history h join opportunities o on o.id = h.opportunity_id
     where o.deleted_at is null and ${where.o}`,
    { id },
  ).map((r) => ({ kind: "status" as const, ...r }));

  const ivs = all<Omit<Extract<TimelineItem, { kind: "interview" }>, "kind">>(
    `select i.id, i.scheduled_at as at, i.stage, i.outcome, i.duration_minutes as durationMinutes, i.self_rating as selfRating,
       o.id as opportunityId, o.title as opportunityTitle
     from interviews i join opportunities o on o.id = i.opportunity_id
     where i.deleted_at is null and o.deleted_at is null and ${
       scope.contactId ? "i.id in (select interview_id from interview_contacts where contact_id = @id)" : where.o
     }`,
    { id },
  ).map((r) => ({ kind: "interview" as const, ...r }));

  return [...acts, ...statuses, ...ivs].sort((a, b) => b.at - a.at);
}

/* ─────────────────────────── details ─────────────────────────── */

export function getCompany(id: number) {
  const db = getDb();
  const company = db.query.companies
    .findFirst({
      where: and(eq(s.companies.id, id), isNull(s.companies.deletedAt)),
      with: { tags: { with: { tag: true } } },
    })
    .sync();
  if (!company) return null;
  const contacts = listContacts().filter((c) => c.companyId === id);
  const opportunities = listOpportunities().filter((o) => o.companyId === id);
  return { company: { ...company, tags: company.tags.map((t) => t.tag.name) }, contacts, opportunities, timeline: getTimeline({ companyId: id }) };
}

export function getContact(id: number) {
  const db = getDb();
  const contact = db.query.contacts
    .findFirst({ where: and(eq(s.contacts.id, id), isNull(s.contacts.deletedAt)), with: { company: true } })
    .sync();
  if (!contact) return null;
  const opportunities = db
    .select({ id: s.opportunities.id, title: s.opportunities.title, status: s.opportunities.status })
    .from(s.opportunityContacts)
    .innerJoin(s.opportunities, eq(s.opportunities.id, s.opportunityContacts.opportunityId))
    .where(and(eq(s.opportunityContacts.contactId, id), isNull(s.opportunities.deletedAt)))
    .all();
  return { contact, opportunities, timeline: getTimeline({ contactId: id }) };
}

export function getOpportunity(id: number) {
  const db = getDb();
  const opportunity = db.query.opportunities
    .findFirst({
      where: and(eq(s.opportunities.id, id), isNull(s.opportunities.deletedAt)),
      with: {
        company: true,
        resumeVersion: true,
        referredBy: true,
        contacts: { with: { contact: true } },
        tags: { with: { tag: true } },
        statusHistory: { orderBy: asc(s.statusHistory.changedAt) },
        interviews: {
          where: isNull(s.interviews.deletedAt),
          orderBy: desc(s.interviews.scheduledAt),
          with: { interviewers: { with: { contact: true } } },
        },
      },
    })
    .sync();
  if (!opportunity) return null;
  return {
    opportunity: {
      ...opportunity,
      tags: opportunity.tags.map((t) => t.tag.name),
      contacts: opportunity.contacts.map((c) => c.contact).filter((c) => !c.deletedAt),
    },
    timeline: getTimeline({ opportunityId: id }),
  };
}

/* ─────────────────────────── lookups (for pickers) ─────────────────────────── */

export function getLookups() {
  return {
    companies: all<{ id: number; name: string; tier: Tier; timezone: string | null; logoUrl: string | null }>(
      `select id, name, tier, timezone, logo_url as logoUrl from companies where deleted_at is null order by name collate nocase`,
    ),
    contacts: all<{ id: number; name: string; role: string | null; companyId: number | null; email: string | null }>(
      `select id, name, role, company_id as companyId, email from contacts where deleted_at is null order by name collate nocase`,
    ),
    opportunities: all<{ id: number; title: string; companyId: number; status: OpportunityStatus }>(
      `select id, title, company_id as companyId, status from opportunities where deleted_at is null order by updated_at desc`,
    ),
    templates: all<{ id: number; name: string; type: string; subject: string | null; body: string }>(
      `select id, name, type, subject, body from templates where deleted_at is null order by name collate nocase`,
    ),
    resumes: all<{ id: number; name: string }>(
      `select id, name from resume_versions where deleted_at is null order by created_at desc`,
    ),
    tags: all<{ name: string }>(`select name from tags where deleted_at is null order by name`).map((t) => t.name),
    /** Recent outbound threads, for picking what a follow-up replies to. */
    threads: all<{
      id: number;
      type: ActivityType;
      occurredAt: number;
      subject: string | null;
      companyId: number | null;
      contactId: number | null;
      contactName: string | null;
      outcome: ActivityOutcome;
    }>(
      `select a.id, a.type, a.occurred_at as occurredAt, a.subject, a.company_id as companyId, a.contact_id as contactId,
         p.name as contactName, a.outcome
       from activities a left join contacts p on p.id = a.contact_id
       where a.deleted_at is null and a.direction = 'outbound' and a.parent_activity_id is null
         and a.type not in ('interview','note') and a.occurred_at > (unixepoch() - 120 * 86400) * 1000
       order by a.occurred_at desc limit 400`,
    ),
  };
}
export type Lookups = ReturnType<typeof getLookups>;

export function listSavedViews(entity: s.SavedViewEntity) {
  return getDb()
    .select()
    .from(s.savedViews)
    .where(and(eq(s.savedViews.entity, entity), isNull(s.savedViews.deletedAt)))
    .orderBy(asc(s.savedViews.createdAt))
    .all();
}

export function listTemplates() {
  return getDb().select().from(s.templates).where(isNull(s.templates.deletedAt)).orderBy(asc(s.templates.name)).all();
}

export function listResumes() {
  return all<{ id: number; name: string; description: string | null; fileUrl: string | null; filePath: string | null; createdAt: number; applications: number }>(
    `select r.id, r.name, r.description, r.file_url as fileUrl, r.file_path as filePath, r.created_at as createdAt,
       (select count(*) from opportunities o where o.resume_version_id = r.id and o.deleted_at is null) as applications
     from resume_versions r where r.deleted_at is null order by r.created_at desc`,
  );
}
