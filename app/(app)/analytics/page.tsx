import { fromZonedTime } from "date-fns-tz";
import { FlaskConical } from "lucide-react";
import { Page, PageHeader } from "@/components/shared/page";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { RangeFilter } from "@/components/analytics/range-filter";
import { getDb } from "@/db/client";
import { getAnalytics, shouldIncludeSeed } from "@/lib/services/analytics";
import { getSettings } from "@/lib/queries/settings";
import { formatTz, startOfDayTz } from "@/lib/dates";

export const metadata = { title: "Analytics" };

const DAY = 86_400_000;
const PRESET_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const sp = await searchParams;
  const settings = getSettings();
  const tz = settings.timezone;
  const now = new Date();
  const range = typeof sp.range === "string" ? sp.range : "30d";
  const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

  let from: Date | null;
  let to = now;
  let label: string;
  if (range === "custom" && isDate(sp.from) && isDate(sp.to)) {
    from = fromZonedTime(`${sp.from}T00:00:00`, tz);
    to = new Date(Math.min(now.getTime(), fromZonedTime(`${sp.to}T00:00:00`, tz).getTime() + DAY));
    label = `${formatTz(from, tz, "MMM d")} – ${formatTz(to.getTime() - 1, tz, "MMM d, yyyy")}`;
  } else if (range === "all") {
    from = null;
    label = "All time";
  } else {
    const days = PRESET_DAYS[range] ?? 30;
    from = new Date(startOfDayTz(now, tz).getTime() - (days - 1) * DAY);
    label = `Last ${days} days`;
  }

  const db = getDb();
  const includeSeed = shouldIncludeSeed(db);
  const data = getAnalytics({ db, tz, range: { from, to }, includeSeed });
  const hasSeed = includeSeed && (db.$client.prepare("select exists(select 1 from activities where is_seed = 1) as s").get() as { s: number }).s === 1;

  return (
    <Page>
      <PageHeader
        title="Analytics"
        description={`${label} · ${tz}`}
        actions={<RangeFilter range={PRESET_DAYS[range] || range === "all" || range === "custom" ? range : "30d"} from={isDate(sp.from) ? sp.from : undefined} to={isDate(sp.to) ? sp.to : undefined} label={label} />}
      />
      {hasSeed && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <FlaskConical className="size-3.5" />
          Showing sample data. As soon as you log your own activity, sample rows are left out of analytics.
        </p>
      )}
      <AnalyticsView data={data} weekStartsOn={settings.weekStartsOn} />
    </Page>
  );
}
