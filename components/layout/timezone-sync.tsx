"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { syncTimezone } from "@/lib/actions/misc";

/**
 * While the timezone is automatic, saves the browser's timezone whenever it
 * differs from the stored one (first run, or after travelling), then
 * re-renders so days and streaks use it.
 */
export function TimezoneSync({ timezone, auto }: { timezone: string; auto: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!auto) return;
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browser || browser === timezone) return;
    void syncTimezone(browser).then((r) => {
      if (r.ok && r.data.changed) router.refresh();
    });
  }, [auto, timezone, router]);
  return null;
}
