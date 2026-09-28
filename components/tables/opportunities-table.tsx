"use client";

import { useMemo } from "react";
import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import { Briefcase, Copy, ExternalLink, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable, SortHeader, selectColumn, type TableView } from "@/components/data-table/data-table";
import { BulkStatusButton, BulkTagButton } from "@/components/data-table/bulk";
import { iso } from "@/components/data-table/csv";
import { CompanyAvatar } from "@/components/shared/company-avatar";
import { StatusMenu } from "@/components/shared/status-menu";
import { Dots, PriorityBars, TierBadge } from "@/components/shared/badges";
import { DateText } from "@/components/shared/relative-time";
import { NextStep } from "@/components/shared/next-step";
import { EmptyState } from "@/components/shared/empty-state";
import { useAppActions } from "@/components/quick-log/app-actions";
import { deleteWithUndo, plural } from "@/lib/client/mutate";
import type { OpportunityRow } from "@/lib/queries/records";
import type { OpportunityInput } from "@/lib/validators";
import type { SavedView } from "@/db/schema";
import { ACTIVE_STATUSES, OPPORTUNITY_STATUSES } from "@/lib/domain";
import { EMPLOYMENT_META, REMOTE_META, SOURCE_META, STATUS_META, TIER_META, options } from "@/lib/meta";
import { features } from "@/lib/table";
import { PeriodEmpty, PeriodTabs, usePeriodFilter } from "@/components/data-table/period-tabs";

type Row = OpportunityRow & { search: string; daysInStage: number };
const helper = createColumnHelper<typeof features, Row>();
const DAY = 86_400_000;
/** When you applied; wishlist roles fall back to when they were added. */
const appliedOrAdded = (r: Row) => r.appliedAt ?? r.createdAt;

/** A new application prefilled from `r`: same company and setup, blank role and link. */
function similarRole(r: Row): Partial<OpportunityInput> {
  return {
    companyId: r.companyId,
    status: "applied",
    employmentType: r.employmentType,
    workMode: r.workMode ?? "",
    country: r.country ?? "",
    source: r.source ?? "",
    resumeVersionId: r.resumeVersionId,
    coverLetterUsed: r.coverLetterUsed,
    tags: r.tags,
  };
}

const BUILT_IN: TableView[] = [
  { name: "All opportunities", builtIn: true, state: {} },
  {
    name: "Active pipeline",
    builtIn: true,
    state: { columnFilters: [{ id: "status", value: ["applied", "screening", "interviewing", "offer"] }], sorting: [{ id: "status", desc: true }] },
  },
  {
    name: "Wishlist — apply next",
    builtIn: true,
    state: { columnFilters: [{ id: "status", value: ["wishlist"] }], sorting: [{ id: "priority", desc: false }] },
  },
  {
    name: "Stuck (14+ days in stage)",
    builtIn: true,
    state: { columnFilters: [{ id: "status", value: ["applied", "screening", "interviewing"] }], sorting: [{ id: "daysInStage", desc: true }] },
  },
  { name: "Closed", builtIn: true, state: { columnFilters: [{ id: "status", value: ["rejected", "ghosted", "withdrawn", "accepted"] }] } },
];

export function OpportunitiesTable({ rows, views, now }: { rows: OpportunityRow[]; views: SavedView[]; now: number }) {
  const { addOpportunity, quickLog } = useAppActions();
  const data = useMemo<Row[]>(
    () =>
      rows.map((r) => ({
        ...r,
        search: [r.title, r.companyName, r.country, r.compensation, ...r.tags].join(" "),
        daysInStage: Math.floor((now - r.stageSince) / DAY),
      })),
    [rows, now],
  );
  const tags = useMemo(() => [...new Set(rows.flatMap((r) => r.tags))].sort(), [rows]);
  const countries = useMemo(() => [...new Set(rows.flatMap((r) => (r.country ? [r.country] : [])))].sort(), [rows]);

  const { period, setPeriod, filtered, counts } = usePeriodFilter(data, appliedOrAdded, now);

  const columns = useMemo(
    () =>
      helper.columns([
        selectColumn<Row>(),
        helper.accessor("title", {
          id: "title",
          header: ({ column }) => <SortHeader column={column} title="Role" />,
          cell: ({ row }) => (
            <Link href={`/opportunities/${row.original.id}`} className="group/link flex max-w-80 min-w-56 items-center gap-2.5">
              <CompanyAvatar name={row.original.companyName} logoUrl={row.original.companyLogo} className="size-6 text-[0.5625rem]" />
              <span className="min-w-0">
                <span className="block truncate font-medium group-hover/link:underline group-hover/link:underline-offset-2">{row.original.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{row.original.companyName}</span>
              </span>
            </Link>
          ),
          sortFn: "text",
          enableHiding: false,
          meta: { label: "Role" },
        }),
        helper.accessor("status", {
          header: ({ column }) => <SortHeader column={column} title="Status" />,
          cell: ({ row }) => <StatusMenu opportunityId={row.original.id} status={row.original.status} />,
          filterFn: "inSet",
          sortFn: (a, b) => OPPORTUNITY_STATUSES.indexOf(a.original.status) - OPPORTUNITY_STATUSES.indexOf(b.original.status),
          meta: { label: "Status" },
        }),
        helper.accessor("daysInStage", {
          header: ({ column }) => <SortHeader column={column} title="In stage" />,
          cell: ({ getValue, row }) => (
            <span className={(ACTIVE_STATUSES as readonly string[]).includes(row.original.status) && getValue() >= 14 ? "tabular text-status-withdrawn" : "tabular text-muted-foreground"}>
              {getValue()}d
            </span>
          ),
          meta: { label: "Days in stage", align: "end" },
        }),
        helper.display({
          id: "next",
          header: "Next",
          cell: ({ row }) => (
            <NextStep nextInterviewAt={row.original.nextInterviewAt} nextFollowUpAt={row.original.nextFollowUpAt} deadline={row.original.deadline} now={now} className="text-xs" />
          ),
          meta: { label: "Next step" },
        }),
        helper.accessor("companyTier", {
          header: "Tier",
          cell: ({ getValue }) => <TierBadge tier={getValue()} />,
          filterFn: "inSet",
          meta: { label: "Tier" },
        }),
        helper.accessor("source", {
          header: "Source",
          cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{getValue() ? SOURCE_META[getValue()!].label : "—"}</span>,
          filterFn: "inSet",
          meta: { label: "Source" },
        }),
        helper.accessor("workMode", {
          header: "Mode",
          cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() ? REMOTE_META[getValue()!].label : "—"}</span>,
          filterFn: "inSet",
          meta: { label: "Work mode" },
        }),
        helper.accessor("country", {
          header: "Country",
          cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{getValue() ?? "—"}</span>,
          filterFn: "inSet",
          meta: { label: "Country" },
        }),
        helper.accessor("employmentType", {
          header: "Type",
          cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{EMPLOYMENT_META[getValue()].label}</span>,
          filterFn: "inSet",
          meta: { label: "Employment type" },
        }),
        helper.accessor("priority", {
          header: ({ column }) => <SortHeader column={column} title="Priority" />,
          cell: ({ getValue }) => <PriorityBars priority={getValue()} />,
          meta: { label: "Priority" },
        }),
        helper.accessor("excitement", {
          header: ({ column }) => <SortHeader column={column} title="Excitement" />,
          cell: ({ getValue }) => <Dots value={getValue()} max={5} label="Excitement" />,
          meta: { label: "Excitement" },
        }),
        helper.accessor("appliedAt", {
          header: ({ column }) => <SortHeader column={column} title="Applied" />,
          cell: ({ getValue }) => <DateText value={getValue()} pattern="MMM d" className="text-muted-foreground" />,
          sortUndefined: "last",
          sortFn: "basic",
          meta: { label: "Applied" },
        }),
        helper.accessor("deadline", {
          header: ({ column }) => <SortHeader column={column} title="Deadline" />,
          cell: ({ getValue }) => <DateText value={getValue()} pattern="MMM d" className="text-muted-foreground" />,
          sortUndefined: "last",
          sortFn: "basic",
          meta: { label: "Deadline" },
        }),
        helper.accessor("compensation", { header: "Pay", cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{getValue() ?? "—"}</span>, meta: { label: "Stipend / salary" } }),
        helper.accessor("resumeName", { header: "Resume", cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{getValue() ?? "—"}</span>, meta: { label: "Resume" } }),
        helper.accessor("tags", {
          header: "Tags",
          cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{getValue().join(", ") || "—"}</span>,
          filterFn: "arrIncludesSome",
          enableSorting: false,
          meta: { label: "Tags" },
        }),
        helper.display({
          id: "actions",
          cell: ({ row }) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.title}`} className="opacity-60 group-hover/row:opacity-100">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/opportunities/${row.original.id}`}>Open</Link>
                </DropdownMenuItem>
                {row.original.jobUrl && (
                  <DropdownMenuItem asChild>
                    <a href={row.original.jobUrl} target="_blank" rel="noreferrer">
                      Job posting <ExternalLink className="ml-auto" />
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={() =>
                    quickLog({
                      type: row.original.status === "wishlist" ? "application" : "follow_up",
                      companyId: row.original.companyId,
                      opportunityId: row.original.id,
                    })
                  }
                >
                  {row.original.status === "wishlist" ? "Log application" : "Log activity"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => addOpportunity(similarRole(row.original))}>
                  <Copy />
                  Apply to similar role
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => deleteWithUndo("opportunities", [row.original.id], row.original.title)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
          enableHiding: false,
          meta: { className: "w-10 px-1" },
        }),
      ]),
    [now, quickLog, addOpportunity],
  );

  return (
    <div className="space-y-3">
      <PeriodTabs period={period} onChange={setPeriod} counts={counts} />
      <DataTable
        entity="opportunities"
        data={filtered}
        columns={columns}
        getRowId={(r) => String(r.id)}
        searchPlaceholder="Search roles, companies, tags…"
        defaultVisibility={{ employmentType: false, compensation: false, resumeName: false, tags: false, deadline: false, workMode: false, excitement: false }}
        defaultSorting={[{ id: "status", desc: false }]}
        facets={[
          { columnId: "status", title: "Status", options: options(STATUS_META) },
          { columnId: "companyTier", title: "Tier", options: options(TIER_META) },
          { columnId: "source", title: "Source", options: options(SOURCE_META) },
          { columnId: "workMode", title: "Mode", options: options(REMOTE_META) },
          { columnId: "country", title: "Country", options: countries.map((c) => ({ value: c, label: c })) },
          { columnId: "tags", title: "Tags", options: tags.map((t) => ({ value: t, label: t })) },
        ]}
        views={[...BUILT_IN, ...views.map((v) => ({ id: v.id, name: v.name, state: v.state }))]}
        csv={{
          filename: "opportunities",
          columns: [
            { header: "Role", value: (r) => r.title },
            { header: "Company", value: (r) => r.companyName },
            { header: "Status", value: (r) => r.status },
            { header: "Employment type", value: (r) => r.employmentType },
            { header: "Work mode", value: (r) => r.workMode },
            { header: "Country", value: (r) => r.country },
            { header: "Source", value: (r) => r.source },
            { header: "Stipend / salary", value: (r) => r.compensation },
            { header: "Job URL", value: (r) => r.jobUrl },
            { header: "Applied", value: (r) => iso(r.appliedAt) },
            { header: "Deadline", value: (r) => iso(r.deadline) },
            { header: "Priority", value: (r) => r.priority },
            { header: "Excitement", value: (r) => r.excitement },
            { header: "Resume", value: (r) => r.resumeName },
            { header: "Tags", value: (r) => r.tags },
            { header: "Days in stage", value: (r) => r.daysInStage },
          ],
        }}
        importable
        primaryAction={
          <Button size="sm" className="h-8" onClick={() => addOpportunity()}>
            <Plus data-icon="inline-start" />
            Application
          </Button>
        }
        bulkActions={(sel, clear) => (
          <>
            <BulkStatusButton ids={sel.map((r) => r.id)} onDone={clear} />
            <BulkTagButton entity="opportunities" ids={sel.map((r) => r.id)} onDone={clear} />
          </>
        )}
        onDeleteRows={(sel, clear) => deleteWithUndo("opportunities", sel.map((r) => r.id), plural(sel.length, "opportunity", "opportunities"), clear)}
        empty={
          data.length > 0 ? (
            <PeriodEmpty period={period} onShowAll={() => setPeriod("all")} />
          ) : (
            <EmptyState
              icon={Briefcase}
              title="No opportunities yet"
              description="Track roles from wishlist to offer. Logging an application creates one automatically."
              action={
                <Button size="sm" onClick={() => addOpportunity()}>
                  <Plus data-icon="inline-start" />
                  New opportunity
                </Button>
              }
            />
          )
        }
      />
    </div>
  );
}
