import { formatInTimeZone } from "date-fns-tz";
import { differenceInCalendarDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

/*
 * All formatting takes an explicit timezone (from settings), so the server
 * render and the client hydrate produce identical strings regardless of
 * the machine's local TZ.
 */

export const DEFAULT_TZ = "UTC";

export function formatTz(date: Date | number, tz: string, pattern: string) {
  return formatInTimeZone(date, tz, pattern);
}

/** yyyy-MM-dd for the calendar day `date` falls on in `tz`. */
export function dayKey(date: Date | number, tz: string) {
  return formatInTimeZone(date, tz, "yyyy-MM-dd");
}

/** Calendar-day distance in `tz` (positive = `date` is in the past). */
export function daysAgo(date: Date | number, now: Date | number, tz: string) {
  return differenceInCalendarDays(toZonedTime(now, tz), toZonedTime(date, tz));
}

/** Compact relative label: "just now", "12m", "3h", "Yesterday", "Mon", "Sep 3". */
export function relativeShort(date: Date | number, now: Date | number, tz: string) {
  const diff = +now - +date;
  if (diff >= 0 && diff < 60_000) return "just now";
  if (diff >= 0 && diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  const days = daysAgo(date, now, tz);
  if (days === 0) return diff >= 0 ? `${Math.floor(diff / 3_600_000)}h ago` : formatTz(date, tz, "HH:mm");
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return formatTz(date, tz, "EEE");
  if (days === -1) return "Tomorrow";
  const sameYear = formatTz(date, tz, "yyyy") === formatTz(now, tz, "yyyy");
  return formatTz(date, tz, sameYear ? "MMM d" : "MMM d, yyyy");
}

/** Greeting by local hour, used on the dashboard. */
export function greeting(now: Date, tz: string) {
  const h = Number(formatInTimeZone(now, tz, "H"));
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** UTC instant of the start of the day containing `date`, in `tz`. */
export function startOfDayTz(date: Date | number, tz: string) {
  const z = toZonedTime(date, tz);
  z.setHours(0, 0, 0, 0);
  return fromZonedTime(z, tz);
}

/** UTC instant of the start of the week containing `date`, in `tz`. */
export function startOfWeekTz(date: Date | number, tz: string, weekStartsOn: number) {
  const z = toZonedTime(date, tz);
  const diff = (z.getDay() - weekStartsOn + 7) % 7;
  z.setDate(z.getDate() - diff);
  z.setHours(0, 0, 0, 0);
  return fromZonedTime(z, tz);
}

/** UTC instant of the start of the month containing `date`, in `tz`. */
export function startOfMonthTz(date: Date | number, tz: string) {
  const z = toZonedTime(date, tz);
  z.setDate(1);
  z.setHours(0, 0, 0, 0);
  return fromZonedTime(z, tz);
}
