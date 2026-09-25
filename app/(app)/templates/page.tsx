import { Page, PageHeader } from "@/components/shared/page";
import { TemplatesView } from "@/components/templates/templates-view";
import { getDb } from "@/db/client";
import { listTemplates } from "@/lib/queries/records";
import { getSettings } from "@/lib/queries/settings";
import { shouldIncludeSeed, templatePerformance } from "@/lib/services/analytics";

export const metadata = { title: "Templates" };

export default function TemplatesPage() {
  const templates = listTemplates();
  const db = getDb();
  const perf = templatePerformance({ db, tz: getSettings().timezone, range: { from: null, to: new Date() }, includeSeed: shouldIncludeSeed(db) });
  const stats = Object.fromEntries(perf.map((p) => [p.id, { sent: p.sent, replied: p.replied }]));
  return (
    <Page>
      <PageHeader title="Templates" description="Messages you send often, with variables filled per contact." />
      <TemplatesView templates={templates} stats={stats} />
    </Page>
  );
}
