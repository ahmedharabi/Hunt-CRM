/** Template variables: {{first_name}}, {{company}}, {{role}}, and a few extras. */

export const TEMPLATE_VARIABLES = [
  { key: "first_name", hint: "Contact's first name" },
  { key: "last_name", hint: "Contact's last name" },
  { key: "full_name", hint: "Contact's full name" },
  { key: "company", hint: "Company name" },
  { key: "role", hint: "Role you're applying for" },
  { key: "contact_role", hint: "Contact's job title" },
] as const;

export type TemplateVars = Partial<Record<(typeof TEMPLATE_VARIABLES)[number]["key"], string | null | undefined>>;

const VAR = /\{\{\s*([a-z_]+)\s*\}\}/gi;

export function varsFor(input: { contactName?: string | null; contactRole?: string | null; company?: string | null; role?: string | null }): TemplateVars {
  const parts = (input.contactName ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0],
    last_name: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
    full_name: input.contactName ?? undefined,
    company: input.company ?? undefined,
    role: input.role ?? undefined,
    contact_role: input.contactRole ?? undefined,
  };
}

/** Fill known variables; unknown or empty ones stay as {{name}} and are reported. */
export function fillTemplate(text: string, vars: TemplateVars) {
  const missing = new Set<string>();
  const out = text.replace(VAR, (match, rawKey: string) => {
    const key = rawKey.toLowerCase() as keyof TemplateVars;
    const value = vars[key];
    if (value && value.trim()) return value.trim();
    missing.add(key);
    return match;
  });
  return { text: out, missing: [...missing] };
}

export function variablesIn(text: string) {
  return [...new Set([...text.matchAll(VAR)].map((m) => m[1].toLowerCase()))];
}
