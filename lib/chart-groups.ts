import type { ActivityType } from "./domain";

/**
 * Ten activity types are too many hues for one chart, so volume charts fold
 * them into five groups. Order and colors are fixed (validated palette in
 * globals.css) and track the per-type hues used on badges.
 */
export const ACTIVITY_GROUPS = [
  { key: "applications", label: "Applications", color: "var(--chart-1)", types: ["application"] },
  { key: "followups", label: "Follow-ups", color: "var(--chart-2)", types: ["follow_up"] },
  { key: "email", label: "Email", color: "var(--chart-3)", types: ["cold_email", "referral_request"] },
  { key: "linkedin", label: "LinkedIn", color: "var(--chart-4)", types: ["linkedin_dm", "linkedin_connection"] },
  { key: "other", label: "Calls, chats & interviews", color: "var(--chart-5)", types: ["call", "coffee_chat", "interview", "note"] },
] as const satisfies readonly { key: string; label: string; color: string; types: readonly ActivityType[] }[];

export type ActivityGroupKey = (typeof ACTIVITY_GROUPS)[number]["key"];

export function groupOf(type: ActivityType): ActivityGroupKey {
  return ACTIVITY_GROUPS.find((g) => (g.types as readonly string[]).includes(type))!.key;
}
