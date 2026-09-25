import { Page, PageHeader } from "@/components/shared/page";
import { CompaniesTable } from "@/components/tables/companies-table";
import { listCompanies, listSavedViews } from "@/lib/queries/records";

export const metadata = { title: "Companies" };

export default function CompaniesPage() {
  const rows = listCompanies();
  const dream = rows.filter((r) => r.tier === "dream").length;
  return (
    <Page>
      <PageHeader
        title="Companies"
        description={`${rows.length} tracked · ${dream} dream`}
      />
      <CompaniesTable rows={rows} views={listSavedViews("companies")} now={new Date().getTime()} />
    </Page>
  );
}
