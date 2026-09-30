import { cookies } from "next/headers";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SiteHeader } from "@/components/layout/site-header";
import { TimezoneSync } from "@/components/layout/timezone-sync";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PrefsProvider } from "@/components/providers/prefs";
import { LookupsProvider } from "@/components/providers/lookups";
import { AppActionsProvider } from "@/components/quick-log/app-actions";
import { ensureDailyBackup } from "@/db/backup";
import { getFollowUpsDueCount } from "@/lib/queries/overview";
import { getSettings } from "@/lib/queries/settings";
import { BACKGROUND_ROUTE, TEXT_SCALE, backgroundCss, clampTextScale } from "@/lib/appearance";
import { colorThemeCss } from "@/lib/themes";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const settings = getSettings();
  // First request of the day snapshots the DB into ./data/backups.
  await ensureDailyBackup(settings.timezone);

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const followUps = getFollowUpsDueCount(new Date(), settings.timezone);

  const textScale = clampTextScale(settings.textScale);
  const themeCss = colorThemeCss(settings.colorTheme);
  const background = settings.backgroundImage
    ? { url: `${BACKGROUND_ROUTE}${encodeURIComponent(settings.backgroundImage)}`, css: backgroundCss({ blur: settings.backgroundBlur, dim: settings.backgroundDim, surface: settings.surfaceOpacity }) }
    : null;

  return (
    <PrefsProvider value={{ timezone: settings.timezone, weekStartsOn: settings.weekStartsOn }}>
      <TimezoneSync timezone={settings.timezone} auto={settings.timezoneAuto} />
      {/* Server-rendered so the saved text size applies on first paint. */}
      {textScale !== TEXT_SCALE.default && <style>{`html{font-size:${textScale}%}`}</style>}
      {themeCss && <style>{themeCss}</style>}
      {background && (
        <>
          <style>{background.css}</style>
          {/* Behind everything: the image (oversized so blurred edges stay off-screen), then the theme color over it. */}
          <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            <div className="absolute -inset-20 bg-cover bg-center" style={{ backgroundImage: `url("${background.url}")`, filter: "blur(var(--bg-blur))" }} />
            <div className="absolute inset-0 bg-background" style={{ opacity: "var(--bg-dim)" }} />
          </div>
        </>
      )}
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
