import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import {
  ACTIVITY_OUTCOMES,
  ACTIVITY_TYPES,
  CHANNELS,
  COMPANY_SIZES,
  DOCUMENT_KINDS,
  CONTACT_TYPES,
  DIRECTIONS,
  EMPLOYMENT_TYPES,
  INTERVIEW_OUTCOMES,
  INTERVIEW_STAGES,
  OPPORTUNITY_SOURCES,
  OPPORTUNITY_STATUSES,
  REMOTE_POLICIES,
  STREAK_MODES,
  TEMPLATE_TYPES,
  TIERS,
  DEFAULT_DAILY_GOALS,
  DEFAULT_STREAK_GOALS,
  DEFAULT_FOLLOW_UP_RULES,
  DEFAULT_WEEKLY_GOALS,
  type DailyGoals,
  type FollowUpRules,
} from "@/lib/domain";

/*
 * Timestamps are stored as integer milliseconds since epoch (UTC).
 * Drizzle maps them to JS Date objects. Day bucketing happens at query
 * time using the timezone from `settings`.
 */
const nowMs = sql`(cast(unixepoch('subsec') * 1000 as integer))`;

const jsonDefault = (value: unknown) => sql.raw(`'${JSON.stringify(value)}'`);

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(nowMs)
    .$onUpdate(() => new Date()),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
};

const base = {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ...timestamps,
  isSeed: integer("is_seed", { mode: "boolean" }).notNull().default(false),
};

export const companies = sqliteTable(
  "companies",
  {
    ...base,
    name: text("name").notNull(),
    website: text("website"),
    linkedinUrl: text("linkedin_url"),
    logoUrl: text("logo_url"),
    industry: text("industry"),
    size: text("size", { enum: COMPANY_SIZES }),
    hqLocation: text("hq_location"),
    country: text("country"),
    timezone: text("timezone"),
    remotePolicy: text("remote_policy", { enum: REMOTE_POLICIES }),
    techStack: text("tech_stack", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    tier: text("tier", { enum: TIERS }).notNull().default("target"),
    notes: text("notes"),
  },
  (t) => [index("companies_name_idx").on(t.name), index("companies_tier_idx").on(t.tier)],
);

export const contacts = sqliteTable(
  "contacts",
  {
    ...base,
    companyId: integer("company_id").references(() => companies.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    role: text("role"),
    contactType: text("contact_type", { enum: CONTACT_TYPES }),
    linkedinUrl: text("linkedin_url"),
    email: text("email"),
    notes: text("notes"),
    lastContactedAt: integer("last_contacted_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("contacts_company_idx").on(t.companyId)],
);

/** CVs and cover letters (the Documents page). Only resumes attach to applications. */
export const resumeVersions = sqliteTable("resume_versions", {
  ...base,
  kind: text("kind", { enum: DOCUMENT_KINDS }).notNull().default("resume"),
  name: text("name").notNull(),
  description: text("description"),
  /** One source: an external link, a path under ./data/uploads, or markdown written in the app. */
  fileUrl: text("file_url"),
  filePath: text("file_path"),
  content: text("content"),
});

export const opportunities = sqliteTable(
  "opportunities",
  {
    ...base,
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    employmentType: text("employment_type", { enum: EMPLOYMENT_TYPES }).notNull().default("internship"),
    workMode: text("work_mode", { enum: REMOTE_POLICIES }),
    country: text("country"),
    jobUrl: text("job_url"),
    source: text("source", { enum: OPPORTUNITY_SOURCES }),
    status: text("status", { enum: OPPORTUNITY_STATUSES }).notNull().default("wishlist"),
    compensation: text("compensation"),
    deadline: integer("deadline", { mode: "timestamp_ms" }),
    appliedAt: integer("applied_at", { mode: "timestamp_ms" }),
    resumeVersionId: integer("resume_version_id").references(() => resumeVersions.id, {
      onDelete: "set null",
    }),
    coverLetterUsed: integer("cover_letter_used", { mode: "boolean" }).notNull().default(false),
    priority: integer("priority").notNull().default(2),
    excitement: integer("excitement").notNull().default(3),
    notes: text("notes"),
    jobDescription: text("job_description"),
    rejectionReason: text("rejection_reason"),
    rejectedAtStage: text("rejected_at_stage", { enum: OPPORTUNITY_STATUSES }),
    referredByContactId: integer("referred_by_contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    /** Sort key inside a Kanban column (fractional indexing friendly). */
    position: integer("position").notNull().default(0),
  },
  (t) => [
    index("opportunities_company_idx").on(t.companyId),
    index("opportunities_status_idx").on(t.status, t.position),
  ],
);

export const opportunityContacts = sqliteTable(
  "opportunity_contacts",
  {
    opportunityId: integer("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [primaryKey({ columns: [t.opportunityId, t.contactId] })],
);

export const statusHistory = sqliteTable(
  "status_history",
  {
    ...base,
    opportunityId: integer("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    fromStatus: text("from_status", { enum: OPPORTUNITY_STATUSES }),
    toStatus: text("to_status", { enum: OPPORTUNITY_STATUSES }).notNull(),
    changedAt: integer("changed_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (t) => [index("status_history_opp_idx").on(t.opportunityId, t.changedAt)],
);

export const templates = sqliteTable("templates", {
  ...base,
  name: text("name").notNull(),
  type: text("type", { enum: TEMPLATE_TYPES }).notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
});

export const activities = sqliteTable(
  "activities",
  {
    ...base,
    type: text("type", { enum: ACTIVITY_TYPES }).notNull(),
    channel: text("channel", { enum: CHANNELS }).notNull().default("other"),
    direction: text("direction", { enum: DIRECTIONS }).notNull().default("outbound"),
    companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
    contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    opportunityId: integer("opportunity_id").references(() => opportunities.id, {
      onDelete: "set null",
    }),
    /** Follow-ups and replies point to the original outreach, forming a thread. */
    parentActivityId: integer("parent_activity_id").references((): AnySQLiteColumn => activities.id, {
      onDelete: "set null",
    }),
    templateId: integer("template_id").references(() => templates.id, { onDelete: "set null" }),
    subject: text("subject"),
    summary: text("summary"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
    outcome: text("outcome", { enum: ACTIVITY_OUTCOMES }).notNull().default("pending"),
    repliedAt: integer("replied_at", { mode: "timestamp_ms" }),
    followUpDueAt: integer("follow_up_due_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("activities_occurred_idx").on(t.occurredAt),
    index("activities_company_idx").on(t.companyId),
    index("activities_contact_idx").on(t.contactId),
    index("activities_opportunity_idx").on(t.opportunityId),
    index("activities_parent_idx").on(t.parentActivityId),
    index("activities_follow_up_idx").on(t.followUpDueAt),
  ],
);

export const interviews = sqliteTable(
  "interviews",
  {
    ...base,
    opportunityId: integer("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    stage: text("stage", { enum: INTERVIEW_STAGES }).notNull(),
    scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(45),
    prepNotes: text("prep_notes"),
    questionsAsked: text("questions_asked"),
    selfRating: integer("self_rating"),
    outcome: text("outcome", { enum: INTERVIEW_OUTCOMES }).notNull().default("scheduled"),
    feedback: text("feedback"),
  },
  (t) => [index("interviews_opp_idx").on(t.opportunityId), index("interviews_when_idx").on(t.scheduledAt)],
);

export const interviewContacts = sqliteTable(
  "interview_contacts",
  {
    interviewId: integer("interview_id")
      .notNull()
      .references(() => interviews.id, { onDelete: "cascade" }),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.interviewId, t.contactId] })],
);

export const tags = sqliteTable(
  "tags",
  {
    ...base,
    name: text("name").notNull(),
    color: text("color"),
  },
  (t) => [uniqueIndex("tags_name_idx").on(t.name)],
);

export const companyTags = sqliteTable(
  "company_tags",
  {
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.tagId] })],
);

export const opportunityTags = sqliteTable(
  "opportunity_tags",
  {
    opportunityId: integer("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.opportunityId, t.tagId] })],
);

export const weeklyReviews = sqliteTable(
  "weekly_reviews",
  {
    ...base,
    /** yyyy-MM-dd of the first day of the week, in the settings timezone. */
    weekStart: text("week_start").notNull(),
    notes: text("notes"),
  },
  (t) => [uniqueIndex("weekly_reviews_week_idx").on(t.weekStart)],
);

/** Free-form markdown notes, the Notes page. */
export const notes = sqliteTable(
  "notes",
  {
    ...base,
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("notes_updated_idx").on(t.updatedAt)],
);

/** Single-row table (id = 1). */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  ...timestamps,
  timezone: text("timezone").notNull().default("Africa/Tunis"),
  /** 0 = Sunday … 6 = Saturday */
  weekStartsOn: integer("week_starts_on").notNull().default(1),
  dailyGoals: text("daily_goals", { mode: "json" })
    .$type<DailyGoals>()
    .notNull()
    .default(jsonDefault(DEFAULT_DAILY_GOALS)),
  weeklyGoals: text("weekly_goals", { mode: "json" })
    .$type<DailyGoals>()
    .notNull()
    .default(jsonDefault(DEFAULT_WEEKLY_GOALS)),
  followUpRules: text("follow_up_rules", { mode: "json" })
    .$type<FollowUpRules>()
    .notNull()
    .default(jsonDefault(DEFAULT_FOLLOW_UP_RULES)),
  ghostingThresholdDays: integer("ghosting_threshold_days").notNull().default(21),
  linkedinWeeklyConnectionLimit: integer("linkedin_weekly_connection_limit").notNull().default(100),
  streakMode: text("streak_mode", { enum: STREAK_MODES }).notNull().default("any_goal"),
  streakGoals: text("streak_goals", { mode: "json" })
    .$type<DailyGoals>()
    .notNull()
    .default(jsonDefault(DEFAULT_STREAK_GOALS)),
  /** Root font size in percent; everything is sized in rem, so it scales the whole UI. */
  textScale: integer("text_scale").notNull().default(100),
  /** Id from lib/themes.ts; "default" is the built-in look. */
  colorTheme: text("color_theme").notNull().default("default"),
  /** Stored file name under data/uploads/backgrounds, served by /api/backgrounds. */
  backgroundImage: text("background_image"),
  backgroundBlur: integer("background_blur").notNull().default(8),
  /** How strongly the theme background is laid over the image, in percent. */
  backgroundDim: integer("background_dim").notNull().default(55),
  /** Opacity of cards and the sidebar over the image, in percent. */
  surfaceOpacity: integer("surface_opacity").notNull().default(85),
});

/* ───────────────────────── relations ───────────────────────── */

export const companiesRelations = relations(companies, ({ many }) => ({
  contacts: many(contacts),
  opportunities: many(opportunities),
  activities: many(activities),
  tags: many(companyTags),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  company: one(companies, { fields: [contacts.companyId], references: [companies.id] }),
  activities: many(activities),
  opportunities: many(opportunityContacts),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  company: one(companies, { fields: [opportunities.companyId], references: [companies.id] }),
  resumeVersion: one(resumeVersions, {
    fields: [opportunities.resumeVersionId],
    references: [resumeVersions.id],
  }),
  referredBy: one(contacts, {
    fields: [opportunities.referredByContactId],
    references: [contacts.id],
  }),
  contacts: many(opportunityContacts),
  statusHistory: many(statusHistory),
  activities: many(activities),
  interviews: many(interviews),
  tags: many(opportunityTags),
}));

export const opportunityContactsRelations = relations(opportunityContacts, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunityContacts.opportunityId],
    references: [opportunities.id],
  }),
  contact: one(contacts, { fields: [opportunityContacts.contactId], references: [contacts.id] }),
}));

export const statusHistoryRelations = relations(statusHistory, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [statusHistory.opportunityId],
    references: [opportunities.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one, many }) => ({
  company: one(companies, { fields: [activities.companyId], references: [companies.id] }),
  contact: one(contacts, { fields: [activities.contactId], references: [contacts.id] }),
  opportunity: one(opportunities, {
    fields: [activities.opportunityId],
    references: [opportunities.id],
  }),
  template: one(templates, { fields: [activities.templateId], references: [templates.id] }),
  parent: one(activities, {
    fields: [activities.parentActivityId],
    references: [activities.id],
    relationName: "thread",
  }),
  children: many(activities, { relationName: "thread" }),
}));

export const interviewsRelations = relations(interviews, ({ one, many }) => ({
  opportunity: one(opportunities, {
    fields: [interviews.opportunityId],
    references: [opportunities.id],
  }),
  interviewers: many(interviewContacts),
}));

export const interviewContactsRelations = relations(interviewContacts, ({ one }) => ({
  interview: one(interviews, { fields: [interviewContacts.interviewId], references: [interviews.id] }),
  contact: one(contacts, { fields: [interviewContacts.contactId], references: [contacts.id] }),
}));

export const companyTagsRelations = relations(companyTags, ({ one }) => ({
  company: one(companies, { fields: [companyTags.companyId], references: [companies.id] }),
  tag: one(tags, { fields: [companyTags.tagId], references: [tags.id] }),
}));

export const opportunityTagsRelations = relations(opportunityTags, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunityTags.opportunityId],
    references: [opportunities.id],
  }),
  tag: one(tags, { fields: [opportunityTags.tagId], references: [tags.id] }),
}));

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type Opportunity = typeof opportunities.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Interview = typeof interviews.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type ResumeVersion = typeof resumeVersions.$inferSelect;
export type Settings = typeof settings.$inferSelect;

export const SAVED_VIEW_ENTITIES = ["companies", "contacts", "opportunities", "activities"] as const;
export type SavedViewEntity = (typeof SAVED_VIEW_ENTITIES)[number];

/** Table state (filters, sorting, visible columns) saved under a name. */
export const savedViews = sqliteTable(
  "saved_views",
  {
    ...base,
    entity: text("entity", { enum: SAVED_VIEW_ENTITIES }).notNull(),
    name: text("name").notNull(),
    state: text("state", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  },
  (t) => [index("saved_views_entity_idx").on(t.entity)],
);

export type SavedView = typeof savedViews.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type WeeklyReview = typeof weeklyReviews.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type StatusHistory = typeof statusHistory.$inferSelect;
