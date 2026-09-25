import type Database from "better-sqlite3";

/*
 * SQLite has no notion of IANA timezones, so day/hour bucketing in SQL
 * would otherwise be UTC. These deterministic user functions let
 * aggregations group by the *local* calendar day, hour and weekday:
 *
 *   select local_day(occurred_at, 'Africa/Tunis'), count(*) … group by 1
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    });
    formatters.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localParts(ms: number, tz: string) {
  const parts: Record<string, string> = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) parts[p.type] = p.value;
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    dow: WEEKDAYS[parts.weekday],
  };
}

export function registerSqlFunctions(sqlite: Database.Database) {
  const opts = { deterministic: true, varargs: false } as const;
  sqlite.function("local_day", opts, (ms: unknown, tz: unknown) =>
    ms == null ? null : localParts(Number(ms), String(tz)).day,
  );
  sqlite.function("local_hour", opts, (ms: unknown, tz: unknown) =>
    ms == null ? null : localParts(Number(ms), String(tz)).hour,
  );
  sqlite.function("local_dow", opts, (ms: unknown, tz: unknown) =>
    ms == null ? null : localParts(Number(ms), String(tz)).dow,
  );
}
