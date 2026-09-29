import { Page } from "@/components/shared/page";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Kbd } from "@/components/ui/kbd";
import { LogoMark } from "@/components/brand/logo";
import { StreakBadge } from "@/components/dashboard/today-goals";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { formatTz, greeting } from "@/lib/dates";
import { getDb } from "@/db/client";
import { getDashboard } from "@/lib/services/dashboard";
import { runGhosting } from "@/lib/services/automation";
import { getOverview } from "@/lib/queries/overview";
import { getSettings } from "@/lib/queries/settings";
import { listNotes } from "@/lib/queries/records";
import { normalizeLayout } from "@/lib/dashboard-layout";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  const settings = getSettings();
  const tz = settings.timezone;
  const now = new Date();
  // Follow-up engine: close silent threads and ghost stale opportunities on load.
  const ghosted = runGhosting(getDb(), now, settings.ghostingThresholdDays);
  const d = getDashboard(getDb(), settings, now);
  const o = getOverview(now, tz, settings.weekStartsOn);

  if (o.companiesCount === 0 && d.recent.length === 0) return <FirstRun />;

  return (
    <Page className="space-y-6">
      <DashboardGrid
        layout={normalizeLayout(settings.dashboardLayout)}
        data={{ d, pipeline: o.pipeline, notes: listNotes().filter((n) => n.pinned), weeklyGoals: settings.weeklyGoals, now: now.getTime() }}
        aside={<StreakBadge {...d.streak} />}
        notice={
          (ghosted.threads > 0 || ghosted.opportunities > 0) && (
            <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
              Tidied up: {ghosted.threads > 0 && `${ghosted.threads} silent thread${ghosted.threads > 1 ? "s" : ""} marked no response`}
              {ghosted.threads > 0 && ghosted.opportunities > 0 && " · "}
              {ghosted.opportunities > 0 && `${ghosted.opportunities} opportunit${ghosted.opportunities > 1 ? "ies" : "y"} moved to Ghosted`} after{" "}
              {settings.ghostingThresholdDays} days of silence.
            </p>
          )
        }
        header={
          <div>
            <p className="text-[0.8125rem] text-muted-foreground">{formatTz(now, tz, "EEEE, MMMM d")}</p>
            <h2 className="mt-0.5 text-2xl font-semibold tracking-[-0.025em]">{greeting(now, tz)}</h2>
          </div>
        }
      />
    </Page>
  );
}

function FirstRun() {
  return (
    <Page className="flex min-h-[70svh] items-center justify-center">
      <Empty className="max-w-md border-0">
        <EmptyHeader>
          <EmptyMedia>
            <LogoMark className="size-10" />
          </EmptyMedia>
          <EmptyTitle className="text-lg">Start your hunt</EmptyTitle>
          <EmptyDescription>
            Log every application, DM and follow-up in a few keystrokes. Hunt reminds you when to follow up and shows what&apos;s working.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="grid w-full gap-2 text-left text-sm">
            {[
              ["A", "Log an application"],
              ["E", "Log a cold email"],
              ["L", "Log a LinkedIn DM"],
              ["Ctrl K", "Search or run any command"],
            ].map(([k, label]) => (
              <div key={k} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="text-muted-foreground">{label}</span>
                <Kbd>{k}</Kbd>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Want to look around first? Run <code className="rounded bg-muted px-1.5 py-0.5 font-mono">npm run db:seed</code>
          </p>
        </EmptyContent>
      </Empty>
    </Page>
  );
}
