import { Page, PageHeader } from "@/components/shared/page";
import { PipelineBoard } from "@/components/pipeline/board";
import { listOpportunities } from "@/lib/queries/records";

export const metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return (
    <Page className="max-w-none">
      <PageHeader title="Pipeline" description="Every opportunity, by stage." />
      <PipelineBoard rows={listOpportunities()} now={new Date().getTime()} />
    </Page>
  );
}
