import { Page, PageHeader } from "@/components/shared/page";
import { OutreachBoard } from "@/components/outreach/outreach-board";
import { getDb } from "@/db/client";
import { runGhosting } from "@/lib/services/automation";
import { companySummary } from "@/lib/outreach";
import { getOutreach } from "@/lib/queries/outreach";
import { getSettings } from "@/lib/queries/settings";

export const metadata = { title: "Outreach" };

export default function OutreachPage() {
  const now = new Date();
  runGhosting(getDb(), now, getSettings().ghostingThresholdDays);
  const companies = getOutreach({ now: now.getTime() });
  const reached = companies.filter((c) => c.people.length > 0);
  const totals = reached.map(companySummary).reduce(
    (t, s) => ({ people: t.people + s.people, replied: t.replied + s.replied, todo: t.todo + s.needsAction }),
    { people: 0, replied: 0, todo: 0 },
  );
  return (
    <Page>
      <PageHeader
        title="Outreach"
        description={
          reached.length
            ? `${totals.people} people at ${reached.length} companies · ${totals.replied} replied · ${totals.todo} waiting on you`
            : "Every person you reach out to, grouped by company."
        }
      />
      <OutreachBoard companies={companies} now={now.getTime()} />
    </Page>
  );
}
