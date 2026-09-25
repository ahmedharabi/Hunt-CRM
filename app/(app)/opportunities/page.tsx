import { Page, PageHeader } from "@/components/shared/page";
import { OpportunitiesTable } from "@/components/tables/opportunities-table";
import { listOpportunities, listSavedViews } from "@/lib/queries/records";

export const metadata = { title: "Opportunities" };

export default function OpportunitiesPage() {
  const rows = listOpportunities();
  const active = rows.filter((r) => ["applied", "screening", "interviewing", "offer"].includes(r.status)).length;
  return (
    <Page>
      <PageHeader title="Opportunities" description={`${rows.length} roles · ${active} in progress`} />
      <OpportunitiesTable rows={rows} views={listSavedViews("opportunities")} now={new Date().getTime()} />
    </Page>
  );
}
