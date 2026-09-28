import { Page, PageHeader } from "@/components/shared/page";
import { ActivitiesTable } from "@/components/tables/activities-table";
import { listActivities, listSavedViews } from "@/lib/queries/records";

export const metadata = { title: "Emails" };

export default function EmailsPage() {
  // Cold emails, email follow-ups and replies: everything on the email channel.
  const rows = listActivities().filter((r) => r.channel === "email");
  const sent = rows.filter((r) => r.direction === "outbound").length;
  const replies = rows.length - sent;
  return (
    <Page>
      <PageHeader title="Emails" description={`${sent} sent · ${replies} ${replies === 1 ? "reply" : "replies"}`} />
      <ActivitiesTable rows={rows} views={listSavedViews("activities")} now={new Date().getTime()} emailsOnly />
    </Page>
  );
}
