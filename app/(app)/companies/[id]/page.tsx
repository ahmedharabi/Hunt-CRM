import { notFound } from "next/navigation";
import { Page } from "@/components/shared/page";
import { CompanyDetail } from "@/components/detail/company-detail";
import { BackLink } from "@/components/detail/back-link";
import { getCompany } from "@/lib/queries/records";
import { getOutreach } from "@/lib/queries/outreach";

export async function generateMetadata({ params }: PageProps<"/companies/[id]">) {
  const { id } = await params;
  return { title: getCompany(Number(id))?.company.name ?? "Company" };
}

export default async function CompanyPage({ params }: PageProps<"/companies/[id]">) {
  const { id } = await params;
  const data = Number.isInteger(Number(id)) ? getCompany(Number(id)) : null;
  if (!data) notFound();
  const now = new Date().getTime();
  const [outreach] = getOutreach({ companyId: data.company.id, now });
  return (
    <Page>
      <BackLink href="/companies">Companies</BackLink>
      <CompanyDetail {...data} outreach={outreach} now={now} />
    </Page>
  );
}
