import path from "node:path";
import { Page, PageHeader } from "@/components/shared/page";
import { Section, SettingsForm } from "@/components/settings/settings-form";
import { DataSection } from "@/components/settings/data-section";
import { ResumesSection } from "@/components/settings/resumes-section";
import { getDb } from "@/db/client";
import { DATA_DIR } from "@/db/paths";
import { listResumes } from "@/lib/queries/records";
import { getSettings } from "@/lib/queries/settings";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  const hasSample = !!getDb().$client.prepare("select 1 from companies where is_seed = 1 and deleted_at is null limit 1").get();
  const rel = path.relative(process.cwd(), DATA_DIR);
  // Show a relative path for the default ./data, the absolute one for e.g. /data in Docker.
  const relDir = rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? `./${rel}` : DATA_DIR;
  return (
    <Page className="max-w-4xl">
      <PageHeader title="Settings" description="Everything is stored locally in one SQLite file." />
      <SettingsForm settings={getSettings()} />
      <div className="border-t">
        <Section title="Resume versions" description="Attach one to each application to compare interview rates.">
          <ResumesSection resumes={listResumes()} />
        </Section>
        <Section title="Data" description="Your data never leaves this machine.">
          <DataSection hasSample={hasSample} dataDir={relDir} />
        </Section>
      </div>
    </Page>
  );
}
