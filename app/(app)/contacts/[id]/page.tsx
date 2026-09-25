import { notFound } from "next/navigation";
import { Page } from "@/components/shared/page";
import { ContactDetail } from "@/components/detail/contact-detail";
import { BackLink } from "@/components/detail/back-link";
import { getContact } from "@/lib/queries/records";

export async function generateMetadata({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  return { title: getContact(Number(id))?.contact.name ?? "Contact" };
}

export default async function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  const data = Number.isInteger(Number(id)) ? getContact(Number(id)) : null;
  if (!data) notFound();
  return (
    <Page>
      <BackLink href="/contacts">Contacts</BackLink>
      <ContactDetail {...data} now={new Date().getTime()} />
    </Page>
  );
}
