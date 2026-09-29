import { z } from "zod";
import {
  ACTIVITY_OUTCOMES,
  ACTIVITY_TYPES,
  CHANNELS,
  COMPANY_SIZES,
  CONTACT_TYPES,
  DIRECTIONS,
  DOCUMENT_KINDS,
  EMPLOYMENT_TYPES,
  INTERVIEW_OUTCOMES,
  INTERVIEW_STAGES,
  OPPORTUNITY_SOURCES,
  OPPORTUNITY_STATUSES,
  REMOTE_POLICIES,
  STREAK_MODES,
  TEMPLATE_TYPES,
  TIERS,
} from "./domain";
import { BACKGROUND, TEXT_SCALE } from "./appearance";
import { COLOR_THEME_IDS } from "./themes";
import { normalizeLayout, WIDGET_IDS, WIDGET_SIZES } from "./dashboard-layout";

/*
 * Shared by react-hook-form (client) and server actions (server).
 * Form inputs are strings; these schemas normalize "" to null so the DB
 * never stores empty strings.
 */

const optText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const optUrl = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null))
  .pipe(z.url({ message: "Enter a valid URL" }).nullable());

/** A URL, or a logo we stored from the company's website (served by /api/logos). */
const optLogoUrl = z.union([
  z
    .string()
    .trim()
    .regex(/^\/api\/logos\/[\w.-]+(\?v=\d+)?$/),
  optUrl,
]);

const optEmail = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .pipe(z.email({ message: "Enter a valid email" }).nullable());

const optEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? (v as T[number]) : null));

const optId = z
  .union([z.coerce.number().int().positive(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (typeof v === "number" ? v : null));

/** Accepts Date, ISO string, datetime-local string, or empty. */
const optDate = z
  .union([z.date(), z.string(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v == null || v === "") return null;
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return d;
  });

const reqDate = optDate.refine((d): d is Date => d !== null, "Pick a date");

export const idSchema = z.coerce.number().int().positive();
export const idsSchema = z.array(idSchema).min(1, "Select at least one row");

export const tagListSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(30)
  .default([])
  .transform((tags) => [...new Set(tags.map((t) => t.toLowerCase()))]);

export const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(120),
  website: optUrl,
  linkedinUrl: optUrl,
  logoUrl: optLogoUrl,
  industry: optText(80),
  size: optEnum(COMPANY_SIZES),
  hqLocation: optText(120),
  country: optText(80),
  timezone: optText(64),
  remotePolicy: optEnum(REMOTE_POLICIES),
  techStack: tagListSchema,
  tier: z.enum(TIERS).default("target"),
  notes: optText(20_000),
  tags: tagListSchema,
});
export type CompanyInput = z.input<typeof companySchema>;
export type CompanyValues = z.output<typeof companySchema>;

export const contactSchema = z.object({
  companyId: optId,
  name: z.string().trim().min(1, "Name is required").max(120),
  role: optText(120),
  contactType: optEnum(CONTACT_TYPES),
  linkedinUrl: optUrl,
  email: optEmail,
  notes: optText(20_000),
});
export type ContactInput = z.input<typeof contactSchema>;
export type ContactValues = z.output<typeof contactSchema>;

export const opportunitySchema = z.object({
  companyId: idSchema.refine(Boolean, "Pick a company"),
  title: z.string().trim().min(1, "Role title is required").max(160),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("internship"),
  workMode: optEnum(REMOTE_POLICIES),
  country: optText(80),
  jobUrl: optUrl,
  source: optEnum(OPPORTUNITY_SOURCES),
  status: z.enum(OPPORTUNITY_STATUSES).default("wishlist"),
  compensation: optText(80),
  deadline: optDate,
  resumeVersionId: optId,
  coverLetterUsed: z.boolean().default(false),
  priority: z.coerce.number().int().min(1).max(3).default(2),
  excitement: z.coerce.number().int().min(1).max(5).default(3),
  notes: optText(20_000),
  jobDescription: optText(60_000),
  rejectionReason: optText(300),
  referredByContactId: optId,
  contactIds: z.array(idSchema).default([]),
  tags: tagListSchema,
});
export type OpportunityInput = z.input<typeof opportunitySchema>;
export type OpportunityValues = z.output<typeof opportunitySchema>;

export const activitySchema = z
  .object({
    type: z.enum(ACTIVITY_TYPES),
    channel: optEnum(CHANNELS),
    direction: z.enum(DIRECTIONS).default("outbound"),
    companyId: optId,
    contactId: optId,
    opportunityId: optId,
    parentActivityId: optId,
    templateId: optId,
    subject: optText(200),
    summary: optText(10_000),
    occurredAt: optDate,
    outcome: z.enum(ACTIVITY_OUTCOMES).default("pending"),
    /** For applications with no opportunity: create one with this title. */
    newOpportunityTitle: optText(160),
    newOpportunityCountry: optText(80),
    /** Inline-create: used when companyId is empty. */
    newCompanyName: optText(120),
    newContactName: optText(120),
    /** Saved onto the (new or existing) contact; creates a contact when none is given. */
    contactEmail: optEmail,
    /** Saved onto the (new or existing) company. */
    companyWebsite: optUrl,
  })
  .superRefine((v, ctx) => {
    if (!v.companyId && !v.newCompanyName && !v.parentActivityId && v.type !== "note") {
      ctx.addIssue({ code: "custom", path: ["companyId"], message: "Pick or create a company" });
    }
  });
export type ActivityInput = z.input<typeof activitySchema>;
export type ActivityValues = z.output<typeof activitySchema>;

export const interviewSchema = z.object({
  opportunityId: idSchema,
  stage: z.enum(INTERVIEW_STAGES),
  scheduledAt: reqDate,
  durationMinutes: z.coerce.number().int().min(5).max(600).default(45),
  prepNotes: optText(20_000),
  questionsAsked: optText(20_000),
  selfRating: z
    .union([z.coerce.number().int().min(1).max(5), z.literal(""), z.null()])
    .optional()
    .transform((v) => (typeof v === "number" ? v : null)),
  outcome: z.enum(INTERVIEW_OUTCOMES).default("scheduled"),
  feedback: optText(20_000),
  interviewerIds: z.array(idSchema).default([]),
});
export type InterviewInput = z.input<typeof interviewSchema>;
export type InterviewValues = z.output<typeof interviewSchema>;

export const templateSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(120),
  type: z.enum(TEMPLATE_TYPES),
  subject: optText(200),
  body: z.string().trim().min(1, "The message can't be empty").max(10_000),
});
export type TemplateInput = z.input<typeof templateSchema>;
export type TemplateValues = z.output<typeof templateSchema>;

export const DOCUMENT_SOURCES = ["file", "link", "write"] as const;

export const resumeSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS).default("resume"),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: optText(1000),
  source: z.enum(DOCUMENT_SOURCES).default("file"),
  fileUrl: optUrl,
  content: optText(50_000),
});

// Partial: the form drops zero ("no goal") entries, and z.record over an enum requires every key.
const goalMap = z.partialRecord(z.enum(ACTIVITY_TYPES), z.coerce.number().int().min(0).max(500));

export const settingsSchema = z.object({
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown timezone"),
  weekStartsOn: z.coerce.number().int().min(0).max(6),
  dailyGoals: goalMap,
  weeklyGoals: goalMap,
  followUpRules: goalMap,
  ghostingThresholdDays: z.coerce.number().int().min(3, "At least 3 days").max(180),
  linkedinWeeklyConnectionLimit: z.coerce.number().int().min(1).max(1000),
  streakMode: z.enum(STREAK_MODES),
  streakGoals: goalMap,
});
export type SettingsValues = z.output<typeof settingsSchema>;

export const colorThemeSchema = z.enum(COLOR_THEME_IDS);

const bgRange = (k: keyof typeof BACKGROUND) => z.coerce.number().int().min(BACKGROUND[k].min).max(BACKGROUND[k].max);
export const backgroundStyleSchema = z.object({ blur: bgRange("blur"), dim: bgRange("dim"), surface: bgRange("surface") });

export const textScaleSchema = z.coerce.number().int().min(TEXT_SCALE.min).max(TEXT_SCALE.max);

export const savedViewSchema = z.object({
  entity: z.enum(["companies", "contacts", "opportunities", "activities"]),
  name: z.string().trim().min(1, "Name the view").max(60),
  state: z.record(z.string(), z.unknown()),
});

export const weeklyNotesSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(50_000),
});

export const dashboardLayoutSchema = z
  .array(
    z.object({
      id: z.enum(WIDGET_IDS),
      size: z.enum(WIDGET_SIZES),
      hidden: z.boolean(),
      title: z.string().trim().max(60).nullable().default(null),
      options: z.record(z.string(), z.union([z.string(), z.boolean(), z.array(z.string())])).default({}),
    }),
  )
  .max(WIDGET_IDS.length)
  // Drops option values the widget doesn't accept.
  .transform(normalizeLayout);

export const noteSchema = z.object({
  title: z.string().max(200),
  body: z.string().max(200_000),
});

export const dateRangeSchema = z.object({
  from: optDate,
  to: optDate,
});
