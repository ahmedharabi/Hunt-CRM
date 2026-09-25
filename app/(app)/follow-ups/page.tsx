import { CalendarDays, Inbox } from "lucide-react";
import { Page, PageHeader } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { FollowUpList } from "@/components/dashboard/follow-up-list";
import { getDb } from "@/db/client";
import { followUpsDue, groupFollowUps } from "@/lib/services/dashboard";
import { runGhosting } from "@/lib/services/automation";
import { startOfDayTz } from "@/lib/dates";
import { getSettings } from "@/lib/queries/settings";
import { cn } from "@/lib/utils";

export const metadata = { title: "Follow-ups" };

export default function FollowUpsPage() {
  const settings = getSettings();
  const now = new Date();
  runGhosting(getDb(), now, settings.ghostingThresholdDays);
  const until = new Date(startOfDayTz(now, settings.timezone).getTime() + 8 * 86_400_000);
  const groups = groupFollowUps(followUpsDue(getDb(), until), now, settings.timezone);
  const total = groups.overdue.length + groups.today.length + groups.week.length;

  const sections = [
    { key: "overdue", title: "Overdue", items: groups.overdue, accent: true },
    { key: "today", title: "Today", items: groups.today },
    { key: "week", title: "This week", items: groups.week },
  ];

  return (
    <Page className="max-w-4xl">
      <PageHeader
        title="Follow-ups"
        description={
          total
            ? `${groups.overdue.length + groups.today.length} due now · ${groups.week.length} later this week`
            : "Threads waiting on you."
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <a href="/api/calendar" download>
              <CalendarDays data-icon="inline-start" />
              Add to calendar
            </a>
          </Button>
        }
      />
      {total === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Inbox}
            title="Inbox zero"
            description={`No follow-ups due in the next week. Outreach gets a reminder automatically; threads go quiet after ${settings.ghostingThresholdDays} days.`}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((s) =>
            s.items.length ? (
              <section key={s.key} className="overflow-hidden rounded-xl border bg-card">
                <h3 className="flex h-10 items-center gap-2 border-b bg-muted/30 px-4 text-[13px] font-medium">
                  <span className={cn("size-1.5 rounded-full", s.accent ? "bg-brand" : "bg-muted-foreground/50")} />
                  {s.title}
                  <span className="tabular text-muted-foreground">{s.items.length}</span>
                </h3>
                <FollowUpList items={s.items} now={now.getTime()} />
              </section>
            ) : null,
          )}
        </div>
      )}
      <p className="mt-6 text-xs text-muted-foreground">
        Reminders come from your rules: cold email {settings.followUpRules.cold_email ?? "–"}d · LinkedIn DM {settings.followUpRules.linkedin_dm ?? "–"}d ·
        application {settings.followUpRules.application ?? "–"}d. Change them in Settings.
      </p>
    </Page>
  );
}
