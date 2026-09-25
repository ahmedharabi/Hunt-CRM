import {
  Coffee,
  CornerDownRight,
  FileUp,
  Handshake,
  Mail,
  MessageSquare,
  Phone,
  StickyNote,
  UserPlus,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { ActivityType, OpportunityStatus, Tier, Channel } from "./domain";

/** Human labels + the CSS variable that carries each category's color. */

export const STATUS_META: Record<OpportunityStatus, { label: string; color: string }> = {
  wishlist: { label: "Wishlist", color: "var(--status-wishlist)" },
  applied: { label: "Applied", color: "var(--status-applied)" },
  screening: { label: "Screening", color: "var(--status-screening)" },
  interviewing: { label: "Interviewing", color: "var(--status-interviewing)" },
  offer: { label: "Offer", color: "var(--status-offer)" },
  accepted: { label: "Accepted", color: "var(--status-accepted)" },
  rejected: { label: "Rejected", color: "var(--status-rejected)" },
  ghosted: { label: "Ghosted", color: "var(--status-ghosted)" },
  withdrawn: { label: "Withdrawn", color: "var(--status-withdrawn)" },
};

export const ACTIVITY_META: Record<ActivityType, { label: string; short: string; icon: LucideIcon; color: string }> = {
  application: { label: "Application", short: "Applied", icon: FileUp, color: "var(--act-application)" },
  cold_email: { label: "Cold email", short: "Email", icon: Mail, color: "var(--act-cold_email)" },
  linkedin_connection: { label: "Connection request", short: "Connect", icon: UserPlus, color: "var(--act-linkedin_connection)" },
  linkedin_dm: { label: "LinkedIn DM", short: "DM", icon: MessageSquare, color: "var(--act-linkedin_dm)" },
  follow_up: { label: "Follow-up", short: "Follow-up", icon: CornerDownRight, color: "var(--act-follow_up)" },
  referral_request: { label: "Referral request", short: "Referral", icon: Handshake, color: "var(--act-referral_request)" },
  call: { label: "Call", short: "Call", icon: Phone, color: "var(--act-call)" },
  coffee_chat: { label: "Coffee chat", short: "Coffee", icon: Coffee, color: "var(--act-coffee_chat)" },
  interview: { label: "Interview", short: "Interview", icon: Video, color: "var(--act-interview)" },
  note: { label: "Note", short: "Note", icon: StickyNote, color: "var(--act-note)" },
};

export const TIER_META: Record<Tier, { label: string }> = {
  dream: { label: "Dream" },
  target: { label: "Target" },
  backup: { label: "Backup" },
};

export const CHANNEL_META: Record<Channel, { label: string }> = {
  email: { label: "Email" },
  linkedin: { label: "LinkedIn" },
  company_site: { label: "Company site" },
  phone: { label: "Phone" },
  other: { label: "Other" },
};

export const INTERVIEW_STAGE_META: Record<import("./domain").InterviewStage, { label: string }> = {
  hr_screen: { label: "HR screen" },
  technical: { label: "Technical" },
  system_design: { label: "System design" },
  behavioral: { label: "Behavioral" },
  take_home: { label: "Take-home" },
  final: { label: "Final round" },
};

export const CONTACT_TYPE_META: Record<import("./domain").ContactType, { label: string }> = {
  recruiter: { label: "Recruiter" },
  engineer: { label: "Engineer" },
  hiring_manager: { label: "Hiring manager" },
  founder: { label: "Founder" },
  alumni: { label: "Alumni" },
  referral: { label: "Referral" },
};

export const SOURCE_META: Record<import("./domain").OpportunitySource, { label: string }> = {
  company_website: { label: "Company website" },
  linkedin_jobs: { label: "LinkedIn Jobs" },
  job_board: { label: "Job board" },
  referral: { label: "Referral" },
  cold_outreach: { label: "Cold outreach" },
  program: { label: "Program" },
};

export const EMPLOYMENT_META: Record<import("./domain").EmploymentType, { label: string }> = {
  internship: { label: "Internship" },
  part_time: { label: "Part-time" },
  full_time: { label: "Full-time" },
};

export const REMOTE_META: Record<import("./domain").RemotePolicy, { label: string }> = {
  remote: { label: "Remote" },
  hybrid: { label: "Hybrid" },
  onsite: { label: "On-site" },
};

export const OUTCOME_META: Record<import("./domain").ActivityOutcome, { label: string; color: string }> = {
  pending: { label: "Awaiting reply", color: "var(--muted-foreground)" },
  replied: { label: "Replied", color: "var(--status-applied)" },
  positive: { label: "Positive", color: "var(--status-accepted)" },
  negative: { label: "Negative", color: "var(--status-rejected)" },
  no_response: { label: "No response", color: "var(--status-ghosted)" },
};

export const INTERVIEW_OUTCOME_META: Record<import("./domain").InterviewOutcome, { label: string; color: string }> = {
  scheduled: { label: "Scheduled", color: "var(--status-applied)" },
  pending: { label: "Awaiting result", color: "var(--status-screening)" },
  passed: { label: "Passed", color: "var(--status-accepted)" },
  failed: { label: "Didn't pass", color: "var(--status-rejected)" },
  cancelled: { label: "Cancelled", color: "var(--status-ghosted)" },
};

export const TEMPLATE_TYPE_META: Record<import("./domain").TemplateType, { label: string; activity: import("./domain").ActivityType }> = {
  cold_email: { label: "Cold email", activity: "cold_email" },
  linkedin_dm: { label: "LinkedIn DM", activity: "linkedin_dm" },
  connection_note: { label: "Connection note", activity: "linkedin_connection" },
  follow_up: { label: "Follow-up", activity: "follow_up" },
};

export const SIZE_OPTIONS = ["1-10", "11-50", "51-200", "201-1000", "1000+"].map((v) => ({ value: v, label: `${v} people` }));

export function options<K extends string>(meta: Record<K, { label: string; color?: string }>) {
  return (Object.keys(meta) as K[]).map((value) => ({ value, label: meta[value].label, color: meta[value].color }));
}
