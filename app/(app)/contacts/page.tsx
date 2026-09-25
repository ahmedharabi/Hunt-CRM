import { Page, PageHeader } from "@/components/shared/page";
import { ContactsTable } from "@/components/tables/contacts-table";
import { listContacts, listSavedViews } from "@/lib/queries/records";

export const metadata = { title: "Contacts" };

export default function ContactsPage() {
  const rows = listContacts();
  return (
    <Page>
      <PageHeader title="Contacts" description={`${rows.length} people`} />
      <ContactsTable rows={rows} views={listSavedViews("contacts")} now={new Date().getTime()} />
    </Page>
  );
}
