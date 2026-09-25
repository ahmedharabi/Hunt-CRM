import { cookies } from "next/headers";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SiteHeader } from "@/components/layout/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PrefsProvider } from "@/components/providers/prefs";
import { LookupsProvider } from "@/components/providers/lookups";
import { AppActionsProvider } from "@/components/quick-log/app-actions";
import { ensureDailyBackup } from "@/db/backup";
import { getFollowUpsDueCount } from "@/lib/queries/overview";
import { getSettings } from "@/lib/queries/settings";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const settings = getSettings();
  // First request of the day snapshots the DB into ./data/backups.
  await ensureDailyBackup(settings.timezone);

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const followUps = getFollowUpsDueCount(new Date(), settings.timezone);

  return (
    <PrefsProvider value={{ timezone: settings.timezone, weekStartsOn: settings.weekStartsOn }}>
      <LookupsProvider>
        <AppActionsProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <AppSidebar counts={{ followUps }} />
            <SidebarInset className="min-w-0">
              <SiteHeader />
              <div className="flex-1 pb-20 md:pb-0">{children}</div>
            </SidebarInset>
          </SidebarProvider>
        </AppActionsProvider>
      </LookupsProvider>
    </PrefsProvider>
  );
}
