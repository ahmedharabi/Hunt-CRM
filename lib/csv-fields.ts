import {
  ACTIVITY_OUTCOMES,
  ACTIVITY_TYPES,
  CHANNELS,
  COMPANY_SIZES,
  CONTACT_TYPES,
  DIRECTIONS,
  EMPLOYMENT_TYPES,
  OPPORTUNITY_SOURCES,
  OPPORTUNITY_STATUSES,
  REMOTE_POLICIES,
  TIERS,
} from "./domain";

/**
 * Importable fields per entity. `aliases` let the mapping step auto-match
 * common CSV headers ("Company Name", "company", "Organization"…).
 */
export type CsvField = { key: string; label: string; required?: boolean; aliases?: string[]; enum?: readonly string[] };

export const CSV_FIELDS: Record<"companies" | "contacts" | "opportunities" | "activities", CsvField[]> = {
  companies: [
    { key: "name", label: "Name", required: true, aliases: ["company", "company name", "organization", "organisation"] },
    { key: "website", label: "Website", aliases: ["url", "site", "domain"] },
    { key: "linkedinUrl", label: "LinkedIn URL", aliases: ["linkedin"] },
    { key: "industry", label: "Industry", aliases: ["sector"] },
    { key: "size", label: "Size", enum: COMPANY_SIZES, aliases: ["employees", "company size"] },
    { key: "hqLocation", label: "HQ location", aliases: ["location", "hq", "city"] },
    { key: "country", label: "Country" },
    { key: "timezone", label: "Timezone", aliases: ["tz", "time zone"] },
    { key: "remotePolicy", label: "Remote policy", enum: REMOTE_POLICIES, aliases: ["remote", "work mode"] },
    { key: "techStack", label: "Tech stack", aliases: ["stack", "technologies", "tech"] },
    { key: "tier", label: "Tier", enum: TIERS, aliases: ["priority"] },
    { key: "tags", label: "Tags" },
    { key: "notes", label: "Notes" },
  ],
  contacts: [
    { key: "name", label: "Name", required: true, aliases: ["full name", "contact", "person"] },
    { key: "companyName", label: "Company", aliases: ["company", "organization", "company name"] },
    { key: "role", label: "Role", aliases: ["title", "position", "job title"] },
    { key: "contactType", label: "Type", enum: CONTACT_TYPES, aliases: ["contact type", "relationship"] },
    { key: "email", label: "Email", aliases: ["e-mail", "email address"] },
    { key: "linkedinUrl", label: "LinkedIn URL", aliases: ["linkedin", "profile"] },
    { key: "notes", label: "Notes" },
  ],
  opportunities: [
    { key: "title", label: "Role", required: true, aliases: ["title", "position", "job title", "role title"] },
    { key: "companyName", label: "Company", required: true, aliases: ["company", "organization", "company name"] },
    { key: "status", label: "Status", enum: OPPORTUNITY_STATUSES, aliases: ["stage"] },
    { key: "employmentType", label: "Employment type", enum: EMPLOYMENT_TYPES, aliases: ["type", "job type"] },
    { key: "workMode", label: "Work mode", enum: REMOTE_POLICIES, aliases: ["remote", "remote policy"] },
    { key: "country", label: "Country", aliases: ["nation", "location"] },
    { key: "jobUrl", label: "Job URL", aliases: ["url", "link", "posting"] },
    { key: "source", label: "Source", enum: OPPORTUNITY_SOURCES },
    { key: "compensation", label: "Stipend / salary", aliases: ["salary", "stipend", "pay", "compensation"] },
    { key: "deadline", label: "Deadline", aliases: ["due", "closing date"] },
    { key: "priority", label: "Priority (1–3)" },
    { key: "excitement", label: "Excitement (1–5)" },
    { key: "tags", label: "Tags" },
    { key: "notes", label: "Notes" },
  ],
  activities: [
    { key: "type", label: "Type", required: true, enum: ACTIVITY_TYPES, aliases: ["activity", "activity type", "kind"] },
    { key: "companyName", label: "Company", aliases: ["company", "organization"] },
    { key: "contactName", label: "Contact", aliases: ["contact", "person", "name"] },
    { key: "occurredAt", label: "Date", aliases: ["date", "when", "sent", "sent at", "occurred at"] },
    { key: "channel", label: "Channel", enum: CHANNELS },
    { key: "direction", label: "Direction", enum: DIRECTIONS },
    { key: "outcome", label: "Outcome", enum: ACTIVITY_OUTCOMES, aliases: ["result", "response"] },
    { key: "subject", label: "Subject" },
    { key: "summary", label: "Summary", aliases: ["notes", "message", "body"] },
  ],
};

const norm = (v: string) => v.trim().toLowerCase().replace(/[\s\-/]+/g, "_").replace(/[^a-z0-9_+]/g, "");

/** Map a free-text CSV value onto an enum value ("LinkedIn DM" → "linkedin_dm"). */
export function coerceEnum(value: string, values: readonly string[]) {
  if (!value.trim()) return "";
  const n = norm(value);
  const exact = values.find((v) => v === n || norm(v) === n);
  if (exact) return exact;
  return values.find((v) => n.includes(v) || v.includes(n)) ?? value;
}

export function guessMapping(headers: string[], fields: CsvField[]) {
  const mapping: Record<string, string> = {};
  for (const f of fields) {
    const candidates = [f.key, f.label, ...(f.aliases ?? [])].map((c) => norm(c));
    const hit = headers.find((h) => candidates.includes(norm(h)));
    if (hit) mapping[f.key] = hit;
  }
  return mapping;
}
