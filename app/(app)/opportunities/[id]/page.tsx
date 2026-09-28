import { notFound } from "next/navigation";
import { Page } from "@/components/shared/page";
import { OpportunityDetail } from "@/components/detail/opportunity-detail";
import { BackLink } from "@/components/detail/back-link";
import { getOpportunity } from "@/lib/queries/records";

export async function generateMetadata({ params }: PageProps<"/opportunities/[id]">) {
  const { id } = await params;
  return { title: getOpportunity(Number(id))?.opportunity.title ?? "Opportunity" };
}

export default async function OpportunityPage({ params }: PageProps<"/opportunities/[id]">) {
  const { id } = await params;
  const data = Number.isInteger(Number(id)) ? getOpportunity(Number(id)) : null;
  if (!data) notFound();
  return (
    <Page>
      <BackLink href="/opportunities">Applications</BackLink>
      <OpportunityDetail {...data} now={new Date().getTime()} />
    </Page>
  );
}
