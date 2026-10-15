import "server-only";
import { getDb } from "@/db/client";
import type { ContactType, Tier } from "@/lib/domain";
import { buildPerson, companySummary, sortPeople, type OutreachActivity, type OutreachCompany } from "@/lib/outreach";

const all = <T,>(sql: string, params: Record<string, unknown> = {}) =>
  getDb().$client.prepare(sql).all(params) as T[];

/** Companies with the people at them and every touchpoint with each person. */
export function getOutreach(opts: { companyId?: number; now?: number } = {}): OutreachCompany[] {
  const now = opts.now ?? Date.now();
  const scope = opts.companyId ? "and c.id = @companyId" : "";
  const params = opts.companyId ? { companyId: opts.companyId } : {};

  const companies = all<Omit<OutreachCompany, "people">>(
    `select c.id, c.name, c.logo_url as logoUrl, c.tier from companies c
     where c.deleted_at is null ${scope}`,
    params,
  );
  const people = all<{ id: number; companyId: number; name: string; role: string | null; contactType: ContactType | null; linkedinUrl: string | null; email: string | null }>(
    `select p.id, p.company_id as companyId, p.name, p.role, p.contact_type as contactType, p.linkedin_url as linkedinUrl, p.email
     from contacts p join companies c on c.id = p.company_id
     where p.deleted_at is null and c.deleted_at is null ${scope}`,
    params,
  );
  const activities = all<OutreachActivity>(
    `select a.id, a.occurred_at as at, a.type, a.direction, a.outcome, a.subject, a.summary,
       a.parent_activity_id as parentActivityId, a.follow_up_due_at as followUpDueAt,
       a.company_id as companyId, a.contact_id as contactId, a.opportunity_id as opportunityId
     from activities a join contacts p on p.id = a.contact_id join companies c on c.id = p.company_id
     where a.deleted_at is null and p.deleted_at is null ${scope}`,
    params,
  );

  const actsByPerson = Map.groupBy(activities, (a) => a.contactId);
  const peopleByCompany = Map.groupBy(people, (p) => p.companyId);

  return companies.map((c) => ({
    ...c,
    tier: c.tier as Tier,
    people: sortPeople(
      (peopleByCompany.get(c.id) ?? []).map((p) => buildPerson(p, actsByPerson.get(p.id) ?? [], now)),
    ),
  })).sort((a, b) => {
    const x = companySummary(a);
    const y = companySummary(b);
    return y.needsAction - x.needsAction || (y.lastAt ?? 0) - (x.lastAt ?? 0);
  });
}
