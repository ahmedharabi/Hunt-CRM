"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { advanceToScreening, dismiss, markReplied, setFollowUpDue, snooze } from "@/lib/actions/activities";
import { useLookups } from "@/components/providers/lookups";
import { usePrefs } from "@/components/providers/prefs";
import { formatTz } from "@/lib/dates";
import { useAppActions } from "./app-actions";

type Thread = { id: number; companyId: number | null; contactId: number | null; opportunityId: number | null };

/** Actions on an outreach thread, shared by the inbox, dashboard, tables and timelines. */
export function useThreadActions() {
  const router = useRouter();
  const { quickLog } = useAppActions();
  const { refresh } = useLookups();
  const { timezone } = usePrefs();

  return useMemo(() => ({
    async markReplied(id: number, sentiment: "replied" | "positive" | "negative" = "replied") {
      const r = await markReplied(id, sentiment);
      if (!r.ok) return toast.error(r.error);
      router.refresh();
      void refresh();
      const suggest = r.data.suggestAdvance;
      if (suggest) {
        // Positive reply on an Applied role: ask, don't assume.
        toast.success("Marked as replied", {
          description: `Move “${suggest.title}” to Screening?`,
          duration: 10_000,
          action: {
            label: "Move to Screening",
            onClick: async () => {
              const a = await advanceToScreening(suggest.opportunityId);
              if (a.ok) {
                toast.success("Moved to Screening");
                router.refresh();
              } else toast.error(a.error);
            },
          },
        });
      } else {
        toast.success(sentiment === "negative" ? "Marked as a negative reply" : "Marked as replied");
      }
    },
    async snooze(id: number, days = 2) {
      const r = await snooze(id, days);
      if (!r.ok) return toast.error(r.error);
      router.refresh();
      const previous = r.data.previous;
      toast(`Snoozed until ${formatTz(r.data.due, timezone, "EEE d MMM")}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            await setFollowUpDue(id, previous ? new Date(previous) : null);
            router.refresh();
          },
        },
      });
    },
    async dismiss(id: number) {
      const r = await dismiss(id);
      if (!r.ok) return toast.error(r.error);
      router.refresh();
      toast("Reminder cleared");
    },
    logFollowUp(t: Thread) {
      quickLog({ type: "follow_up", parentActivityId: t.id, companyId: t.companyId, contactId: t.contactId, opportunityId: t.opportunityId });
    },
  }), [router, quickLog, refresh, timezone]);
}
