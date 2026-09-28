"use client";

import { useMemo } from "react";
import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import { Activity, ArrowDownLeft, Mail, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, SortHeader, selectColumn, type TableView } from "@/components/data-table/data-table";
import { BulkOutcomeButton } from "@/components/data-table/bulk";
import { iso } from "@/components/data-table/csv";
import { ActivityIcon } from "@/components/shared/status-badge";
import { RelativeTime } from "@/components/shared/relative-time";
import { EmptyState } from "@/components/shared/empty-state";
import { useAppActions } from "@/components/quick-log/app-actions";
import { useThreadActions } from "@/components/quick-log/thread-actions";
import { deleteWithUndo, plural } from "@/lib/client/mutate";
import type { ActivityRow } from "@/lib/queries/records";
import type { SavedView } from "@/db/schema";
import { ACTIVITY_META, CHANNEL_META, OUTCOME_META, options } from "@/lib/meta";
import { features } from "@/lib/table";

type Row = ActivityRow & { search: string; waiting: "over7" | "under7" | "na"; isRoot: "root" | "reply" };
const helper = createColumnHelper<typeof features, Row>();
const DAY = 86_400_000;

const BUILT_IN: TableView[] = [
  { name: "All activity", builtIn: true, state: {} },
  {
    name: "Awaiting reply > 7 days",
    builtIn: true,
    state: { columnFilters: [{ id: "waiting", value: ["over7"] }], sorting: [{ id: "occurredAt", desc: false }] },
  },
  { name: "Replies received", builtIn: true, state: { columnFilters: [{ id: "direction", value: ["inbound"] }] } },
  {
    name: "New outreach only",
    builtIn: true,
    state: { columnFilters: [{ id: "isRoot", value: ["root"] }, { id: "direction", value: ["outbound"] }] },
  },
];

export function OutcomePill({ outcome }: { outcome: keyof typeof OUTCOME_META }) {
  const m = OUTCOME_META[outcome];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
      <span className="size-1.5 rounded-full" style={{ backgroundColor: m.color }} />
      {m.label}
    </span>
  );
}

export function ActivitiesTable({
  rows,
  views,
  now,
  emailsOnly = false,
}: {
  rows: ActivityRow[];
  views: SavedView[];
  now: number;
  /** The Emails page: rows are already filtered to the email channel. */
  emailsOnly?: boolean;
}) {
  const { quickLog } = useAppActions();
  const thread = useThreadActions();
  const data = useMemo<Row[]>(
    () =>
      rows.map((r) => ({
        ...r,
        search: [ACTIVITY_META[r.type].label, r.subject, r.summary, r.companyName, r.contactName, r.opportunityTitle].join(" "),
        waiting:
          r.direction === "outbound" && r.outcome === "pending" && !r.parentActivityId && !r.hasReply
            ? now - r.occurredAt > 7 * DAY
              ? "over7"
              : "under7"
            : "na",
        isRoot: r.parentActivityId ? "reply" : "root",
      })),
    [rows, now],
  );

  const columns = useMemo(
    () =>
      helper.columns([
        selectColumn<Row>(),
        helper.accessor("type", {
          id: "type",
          header: ({ column }) => <SortHeader column={column} title="Activity" />,
          cell: ({ row }) => {
            const r = row.original;
            return (
              <div className="flex min-w-56 items-center gap-2.5">
                <ActivityIcon type={r.type} className="size-6" />
                <div className="min-w-0">
                  <p className="flex items-center gap-1 truncate font-medium">
                    {r.direction === "inbound" && <ArrowDownLeft className="size-3.5 text-status-accepted" aria-label="Received" />}
                    {r.direction === "inbound" ? "Reply" : ACTIVITY_META[r.type].label}
                    {r.parentActivityId && r.direction === "outbound" && <span className="text-xs font-normal text-muted-foreground">in thread</span>}
                  </p>
                  {(r.subject || r.summary) && <p className="max-w-80 truncate text-xs text-muted-foreground">{r.subject || r.summary}</p>}
                </div>
              </div>
            );
          },
          filterFn: "inSet",
          enableHiding: false,
          meta: { label: "Activity" },
        }),
        helper.accessor("companyName", {
          header: ({ column }) => <SortHeader column={column} title="Company" />,
          cell: ({ row }) =>
            row.original.companyId ? (
              <Link href={`/companies/${row.original.companyId}`} className="whitespace-nowrap hover:underline hover:underline-offset-2">
                {row.original.companyName}
              </Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
          meta: { label: "Company" },
        }),
        helper.accessor("contactName", {
          header: "Contact",
          cell: ({ row }) =>
            row.original.contactId ? (
              <Link href={`/contacts/${row.original.contactId}`} className="whitespace-nowrap text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-2">
                {row.original.contactName}
              </Link>
            ) : (
              <span className="text-muted-foreground/60">—</span>
            ),
          meta: { label: "Contact" },
        }),
        helper.accessor("opportunityTitle", {
          header: "Opportunity",
          cell: ({ row }) =>
            row.original.opportunityId ? (
              <Link href={`/opportunities/${row.original.opportunityId}`} className="whitespace-nowrap text-muted-foreground hover:text-foreground hover:underline">
                {row.original.opportunityTitle}
              </Link>
            ) : (
              <span className="text-muted-foreground/60">—</span>
            ),
          meta: { label: "Opportunity" },
        }),
        helper.accessor("channel", {
          header: "Channel",
          cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{CHANNEL_META[getValue()].label}</span>,
          filterFn: "inSet",
          meta: { label: "Channel" },
        }),
        helper.accessor("direction", { header: "Direction", filterFn: "inSet", meta: { label: "Direction" } }),
        helper.accessor("outcome", {
          header: ({ column }) => <SortHeader column={column} title="Outcome" />,
          cell: ({ row }) => (row.original.direction === "inbound" ? <span className="text-muted-foreground/60">—</span> : <OutcomePill outcome={row.original.outcome} />),
          filterFn: "inSet",
          meta: { label: "Outcome" },
        }),
        helper.accessor("occurredAt", {
          header: ({ column }) => <SortHeader column={column} title="When" />,
          cell: ({ getValue }) => <RelativeTime value={getValue()} now={now} className="text-muted-foreground" />,
          sortFn: "basic",
          meta: { label: "When" },
        }),
        helper.accessor("followUpDueAt", {
          header: ({ column }) => <SortHeader column={column} title="Follow up" />,
          cell: ({ getValue }) => {
            const v = getValue();
            if (!v) return <span className="text-muted-foreground/60">—</span>;
            return <RelativeTime value={v} now={now} className={v < now ? "font-medium text-brand" : "text-muted-foreground"} />;
          },
          sortUndefined: "last",
          sortFn: "basic",
          meta: { label: "Follow-up due" },
        }),
        helper.accessor("templateName", { header: "Template", cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() ?? "—"}</span>, meta: { label: "Template" } }),
        helper.accessor("waiting", { header: "Waiting", filterFn: "inSet", meta: { label: "Waiting" } }),
        helper.accessor("isRoot", { header: "Thread", filterFn: "inSet", meta: { label: "Thread" } }),
        helper.display({
          id: "actions",
          cell: ({ row }) => {
            const r = row.original;
            const threadId = r.parentActivityId ?? r.id;
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Actions" className="opacity-60 group-hover/row:opacity-100">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {r.direction === "outbound" && (
                    <>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Mark replied</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onSelect={() => thread.markReplied(threadId, "positive")}>Positive reply</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => thread.markReplied(threadId, "replied")}>Neutral reply</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => thread.markReplied(threadId, "negative")}>Negative reply</DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuItem onSelect={() => thread.logFollowUp({ id: threadId, companyId: r.companyId, contactId: r.contactId, opportunityId: r.opportunityId })}>
                        Log follow-up
                      </DropdownMenuItem>
                      {r.followUpDueAt && <DropdownMenuItem onSelect={() => thread.snooze(r.id, 2)}>Snooze 2 days</DropdownMenuItem>}
                    </>
                  )}
                  <DropdownMenuItem onSelect={() => quickLog({ type: r.type, companyId: r.companyId, contactId: r.contactId, opportunityId: r.opportunityId })}>
                    Log another like this
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => deleteWithUndo("activities", [r.id], ACTIVITY_META[r.type].label.toLowerCase())}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          },
          enableHiding: false,
          meta: { className: "w-10 px-1" },
        }),
      ]),
    [now, quickLog, thread],
  );

  return (
    <DataTable
      entity="activities"
      data={data}
      columns={columns}
      getRowId={(r) => String(r.id)}
      searchPlaceholder="Search messages, companies, people…"
      defaultVisibility={{ opportunityTitle: false, templateName: false, waiting: false, isRoot: false, direction: false, channel: !emailsOnly }}
      defaultSorting={[{ id: "occurredAt", desc: true }]}
      facets={[
        { columnId: "type", title: "Type", options: options(ACTIVITY_META) },
        ...(emailsOnly ? [] : [{ columnId: "channel", title: "Channel", options: options(CHANNEL_META) }]),
        { columnId: "outcome", title: "Outcome", options: options(OUTCOME_META) },
        {
          columnId: "direction",
          title: "Direction",
          options: [
            { value: "outbound", label: "Sent" },
            { value: "inbound", label: "Received" },
          ],
        },
        {
          columnId: "waiting",
          title: "Awaiting reply",
          options: [
            { value: "over7", label: "More than 7 days" },
            { value: "under7", label: "7 days or less" },
          ],
        },
      ]}
      views={[...BUILT_IN, ...views.map((v) => ({ id: v.id, name: v.name, state: v.state }))]}
      csv={{
        filename: emailsOnly ? "emails" : "activities",
        columns: [
          { header: "Type", value: (r) => r.type },
          { header: "Direction", value: (r) => r.direction },
          { header: "Channel", value: (r) => r.channel },
          { header: "Company", value: (r) => r.companyName },
          { header: "Contact", value: (r) => r.contactName },
          { header: "Opportunity", value: (r) => r.opportunityTitle },
          { header: "Subject", value: (r) => r.subject },
          { header: "Summary", value: (r) => r.summary },
          { header: "Date", value: (r) => iso(r.occurredAt) },
          { header: "Outcome", value: (r) => r.outcome },
          { header: "Replied at", value: (r) => iso(r.repliedAt) },
          { header: "Follow-up due", value: (r) => iso(r.followUpDueAt) },
          { header: "Template", value: (r) => r.templateName },
        ],
      }}
      importable
      primaryAction={
        <Button size="sm" className="h-8" onClick={() => quickLog(emailsOnly ? { type: "cold_email" } : undefined)}>
          <Plus data-icon="inline-start" />
          {emailsOnly ? "Log email" : "Log"}
        </Button>
      }
      bulkActions={(sel, clear) => <BulkOutcomeButton ids={sel.map((r) => r.id)} onDone={clear} />}
      onDeleteRows={(sel, clear) => deleteWithUndo("activities", sel.map((r) => r.id), plural(sel.length, "activity", "activities"), clear)}
      empty={
        <EmptyState
          icon={emailsOnly ? Mail : Activity}
          title={emailsOnly ? "No emails yet" : "Nothing logged yet"}
          description={
            <>
              Every application, DM and follow-up lands here. Press <kbd className="rounded border px-1 font-mono text-xs">E</kbd> anywhere to log a cold
              email.
            </>
          }
          action={
            <Button size="sm" onClick={() => quickLog()}>
              <Plus data-icon="inline-start" />
              Log activity
            </Button>
          }
        />
      }
    />
  );
}
