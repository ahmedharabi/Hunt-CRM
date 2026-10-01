/**
 * Domain vocabulary shared by the DB schema, zod validators, and the UI.
 * Every enum lives here once so badges, charts and forms stay in sync.
 */

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export const REMOTE_POLICIES = ["remote", "hybrid", "onsite"] as const;
export type RemotePolicy = (typeof REMOTE_POLICIES)[number];

export const TIERS = ["dream", "target", "backup"] as const;
export type Tier = (typeof TIERS)[number];

export const CONTACT_TYPES = [
  "recruiter",
  "engineer",
  "hiring_manager",
  "founder",
  "alumni",
  "referral",
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const EMPLOYMENT_TYPES = ["internship", "part_time", "full_time"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const OPPORTUNITY_SOURCES = [
  "company_website",
  "linkedin_jobs",
  "job_board",
  "referral",
  "cold_outreach",
  "program",
] as const;
export type OpportunitySource = (typeof OPPORTUNITY_SOURCES)[number];

/** Pipeline order matters: the funnel and Kanban read it left to right. */
export const ACTIVE_STATUSES = [
  "wishlist",
  "applied",
  "screening",
  "interviewing",
  "offer",
  "accepted",
] as const;
export const TERMINAL_STATUSES = ["rejected", "ghosted", "withdrawn"] as const;
export const OPPORTUNITY_STATUSES = [...ACTIVE_STATUSES, ...TERMINAL_STATUSES] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

/** The statuses offered when changing one by hand: the pipeline board's columns. */
export const PICKABLE_STATUSES = ["applied", "interviewing", "offer", "rejected"] as const satisfies readonly OpportunityStatus[];

/** Pickable statuses, plus the current one if it's an older status, so it still shows. */
export function statusChoices(current?: OpportunityStatus): OpportunityStatus[] {
  return !current || (PICKABLE_STATUSES as readonly string[]).includes(current) ? [...PICKABLE_STATUSES] : [current, ...PICKABLE_STATUSES];
}

export const ACTIVITY_TYPES = [
  "application",
  "cold_email",
  "linkedin_connection",
  "linkedin_dm",
  "follow_up",
  "referral_request",
  "call",
  "coffee_chat",
  "interview",
  "note",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const CHANNELS = ["email", "linkedin", "company_site", "phone", "other"] as const;
export type Channel = (typeof CHANNELS)[number];

export const DIRECTIONS = ["outbound", "inbound"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const ACTIVITY_OUTCOMES = ["pending", "replied", "positive", "negative", "no_response"] as const;
export type ActivityOutcome = (typeof ACTIVITY_OUTCOMES)[number];

export const INTERVIEW_STAGES = [
  "hr_screen",
  "technical",
  "system_design",
  "behavioral",
  "take_home",
  "final",
] as const;
export type InterviewStage = (typeof INTERVIEW_STAGES)[number];

export const INTERVIEW_OUTCOMES = ["scheduled", "passed", "failed", "pending", "cancelled"] as const;
export type InterviewOutcome = (typeof INTERVIEW_OUTCOMES)[number];

export const DOCUMENT_KINDS = ["resume", "cover_letter"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const TEMPLATE_TYPES = ["cold_email", "linkedin_dm", "connection_note", "follow_up"] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

/**
 * Allowed status transitions — the single source of truth.
 * Terminal statuses can be reopened back into the pipeline (a ghosted
 * company sometimes replies months later).
 */
export const STATUS_TRANSITIONS: Record<OpportunityStatus, readonly OpportunityStatus[]> = {
  wishlist: ["applied", "withdrawn"],
  applied: ["screening", "interviewing", "offer", "rejected", "ghosted", "withdrawn"],
  screening: ["interviewing", "offer", "rejected", "ghosted", "withdrawn"],
  interviewing: ["offer", "rejected", "ghosted", "withdrawn"],
  offer: ["accepted", "rejected", "withdrawn"],
  accepted: ["withdrawn"],
  rejected: ["wishlist", "applied", "screening", "interviewing"],
  ghosted: ["applied", "screening", "interviewing", "rejected"],
  withdrawn: ["wishlist", "applied"],
};

export function canTransition(from: OpportunityStatus, to: OpportunityStatus): boolean {
  return from !== to && STATUS_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: OpportunityStatus): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function pipelineIndex(status: OpportunityStatus): number {
  return (ACTIVE_STATUSES as readonly string[]).indexOf(status);
}

/** Activity types that start a thread and expect a reply. */
export const OUTREACH_TYPES: readonly ActivityType[] = [
  "application",
  "cold_email",
  "linkedin_connection",
  "linkedin_dm",
  "referral_request",
];

export type DailyGoals = Partial<Record<ActivityType, number>>;
export type FollowUpRules = Partial<Record<ActivityType, number>>;

export const DEFAULT_DAILY_GOALS: DailyGoals = {
  application: 2,
  cold_email: 3,
  linkedin_dm: 3,
  linkedin_connection: 5,
  follow_up: 2,
};

/** Targets a day must hit to count toward the streak (separate from the dashboard's goal rings). */
export const DEFAULT_STREAK_GOALS: DailyGoals = {
  application: 2,
  cold_email: 3,
};

export const DEFAULT_WEEKLY_GOALS: DailyGoals = {
  application: 10,
  cold_email: 15,
  linkedin_dm: 15,
  linkedin_connection: 25,
  follow_up: 10,
};

export const DEFAULT_FOLLOW_UP_RULES: FollowUpRules = {
  cold_email: 5,
  linkedin_dm: 7,
  linkedin_connection: 7,
  referral_request: 5,
  application: 10,
};

export const STREAK_MODES = ["any_activity", "all_goals", "any_goal"] as const;
export type StreakMode = (typeof STREAK_MODES)[number];
