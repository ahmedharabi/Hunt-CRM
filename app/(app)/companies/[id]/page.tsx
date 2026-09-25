import { notFound } from "next/navigation";
import { Page } from "@/components/shared/page";
import { CompanyDetail } from "@/components/detail/company-detail";
import { BackLink } from "@/components/detail/back-link";
import { getCompany } from "@/lib/queries/records";

export async function generateMetadata({ params }: PageProps<"/companies/[id]">) {
  const { id } = await params;
  return { title: getCompany(Number(id))?.company.name ?? "Company" };
}

export default async function CompanyPage({ params }: PageProps<"/companies/[id]">) {
  const { id } = await params;
  const data = Number.isInteger(Number(id)) ? getCompany(Number(id)) : null;
  if (!data) notFound();
  return (
    <Page>
      <BackLink href="/companies">Companies</BackLink>
      <CompanyDetail {...data} now={new Date().getTime()} />
    </Page>
  );
}
