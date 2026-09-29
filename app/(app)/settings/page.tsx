import path from "node:path";
import { Page, PageHeader } from "@/components/shared/page";
import { Section, SettingsForm } from "@/components/settings/settings-form";
import { DataSection } from "@/components/settings/data-section";
import Link from "next/link";
import { FileUser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db/client";
import { DATA_DIR } from "@/db/paths";
import { getSettings } from "@/lib/queries/settings";
import { APP_VERSION } from "@/lib/services/updates";
import { UpdatesSection } from "@/components/settings/updates-section";

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
        <Section title="CVs & cover letters" description="Attach a CV to each application to compare interview rates.">
          <Button variant="outline" asChild>
            <Link href="/documents">
              <FileUser data-icon="inline-start" />
              Manage in Documents
            </Link>
          </Button>
        </Section>
        <Section title="Updates" description="Get a note in the sidebar when a new version of Hunt is released.">
          <UpdatesSection version={APP_VERSION} enabled={getSettings().checkUpdates} envDisabled={process.env.HUNT_UPDATE_CHECK === "0"} />
        </Section>
        <Section title="Data" description="Your data never leaves this machine.">
          <DataSection hasSample={hasSample} dataDir={relDir} />
        </Section>
      </div>
    </Page>
  );
}
