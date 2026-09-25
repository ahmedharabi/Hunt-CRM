"use client";

import { fromZonedTime } from "date-fns-tz";
import { Input } from "@/components/ui/input";
import { usePrefs } from "@/components/providers/prefs";
import { formatTz } from "@/lib/dates";

/**
 * Native date/time input, interpreted in the settings timezone (not the
 * browser's) so what you type matches what the rest of the app shows.
 */
export function DateTimeInput({
  value,
  onChange,
  dateOnly,
  id,
  className,
  "aria-invalid": invalid,
}: {
  value: Date | string | null | undefined;
  onChange: (value: Date | null) => void;
  dateOnly?: boolean;
  id?: string;
  className?: string;
  "aria-invalid"?: boolean;
}) {
  const { timezone } = usePrefs();
  const date = value ? (value instanceof Date ? value : new Date(value)) : null;
  const pattern = dateOnly ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm";
  const str = date && !Number.isNaN(date.getTime()) ? formatTz(date, timezone, pattern) : "";
  return (
    <Input
      id={id}
      type={dateOnly ? "date" : "datetime-local"}
      value={str}
      aria-invalid={invalid}
      className={className}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return onChange(null);
        onChange(fromZonedTime(dateOnly ? `${v}T12:00:00` : v, timezone));
      }}
    />
  );
}
