import { Page, PageHeader } from "@/components/shared/page";
import { ActivitiesTable } from "@/components/tables/activities-table";
import { listActivities, listSavedViews } from "@/lib/queries/records";

export const metadata = { title: "Activities" };

export default function ActivitiesPage() {
  const rows = listActivities();
  return (
    <Page>
      <PageHeader title="Activities" description="Every touchpoint, newest first." />
      <ActivitiesTable rows={rows} views={listSavedViews("activities")} now={new Date().getTime()} />
    </Page>
  );
}
