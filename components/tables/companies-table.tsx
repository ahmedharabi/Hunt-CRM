"use client";

import { useMemo } from "react";
import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import { Building2, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable, SortHeader, selectColumn, type TableView } from "@/components/data-table/data-table";
import { BulkTagButton } from "@/components/data-table/bulk";
import { iso } from "@/components/data-table/csv";
import { CompanyAvatar } from "@/components/shared/company-avatar";
import { TierBadge } from "@/components/shared/badges";
import { RelativeTime } from "@/components/shared/relative-time";
import { EmptyState } from "@/components/shared/empty-state";
import { useAppActions } from "@/components/quick-log/app-actions";
import { deleteWithUndo, plural } from "@/lib/client/mutate";
import type { CompanyRow } from "@/lib/queries/records";
import type { SavedView } from "@/db/schema";
import { REMOTE_META, TIER_META, options } from "@/lib/meta";
import { features } from "@/lib/table";

type Row = CompanyRow & { search: string; contacted: "yes" | "no"; recency: string };

const helper = createColumnHelper<typeof features, Row>();
const DAY = 86_400_000;

const BUILT_IN: TableView[] = [
  { name: "All companies", builtIn: true, state: {} },
  {
    name: "Dream companies not contacted",
    builtIn: true,
    state: { columnFilters: [{ id: "tier", value: ["dream"] }, { id: "contacted", value: ["no"] }] },
  },
  {
    name: "Gone quiet (30+ days)",
    builtIn: true,
    state: { columnFilters: [{ id: "recency", value: ["older"] }], sorting: [{ id: "lastActivityAt", desc: false }] },
  },
  { name: "Most active", builtIn: true, state: { sorting: [{ id: "touchpoints", desc: true }] } },
];

export function CompaniesTable({ rows, views, now }: { rows: CompanyRow[]; views: SavedView[]; now: number }) {
  const { addCompany, quickLog } = useAppActions();

  const data = useMemo<Row[]>(
    () =>
      rows.map((r) => ({
        ...r,
        search: [r.name, r.industry, r.country, r.hqLocation, ...r.techStack, ...r.tags].join(" "),
        contacted: r.touchpoints > 0 ? "yes" : "no",
        recency: !r.lastActivityAt ? "never" : now - r.lastActivityAt < 7 * DAY ? "week" : now - r.lastActivityAt < 30 * DAY ? "month" : "older",
      })),
    [rows, now],
  );

  const industries = useMemo(() => [...new Set(rows.map((r) => r.industry).filter(Boolean) as string[])].sort(), [rows]);
  const countries = useMemo(() => [...new Set(rows.map((r) => r.country).filter(Boolean) as string[])].sort(), [rows]);
  const tags = useMemo(() => [...new Set(rows.flatMap((r) => r.tags))].sort(), [rows]);

  const columns = useMemo(
    () =>
      helper.columns([
        selectColumn<Row>(),
        helper.accessor("name", {
          id: "name",
          header: ({ column }) => <SortHeader column={column} title="Company" />,
          cell: ({ row }) => (
            <Link href={`/companies/${row.original.id}`} className="group/link flex min-w-44 items-center gap-2.5">
              <CompanyAvatar name={row.original.name} logoUrl={row.original.logoUrl} className="size-6 text-[9px]" />
              <span className="min-w-0">
                <span className="block truncate font-medium group-hover/link:underline group-hover/link:underline-offset-2">{row.original.name}</span>
                {row.original.website && (
                  <span className="block truncate text-xs text-muted-foreground">{row.original.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
                )}
              </span>
            </Link>
          ),
          sortFn: "text",
          meta: { label: "Company" },
          enableHiding: false,
        }),
        helper.accessor("tier", {
          header: ({ column }) => <SortHeader column={column} title="Tier" />,
          cell: ({ getValue }) => <TierBadge tier={getValue()} />,
          filterFn: "inSet",
          sortFn: (a, b) => ["dream", "target", "backup"].indexOf(a.original.tier) - ["dream", "target", "backup"].indexOf(b.original.tier),
          meta: { label: "Tier" },
        }),
        helper.accessor("industry", {
          header: ({ column }) => <SortHeader column={column} title="Industry" />,
          cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{getValue() ?? "—"}</span>,
          filterFn: "inSet",
          meta: { label: "Industry" },
        }),
        helper.accessor("techStack", {
          header: "Stack",
          cell: ({ getValue }) => (
            <span className="flex max-w-56 gap-1 overflow-hidden">
              {getValue().slice(0, 3).map((t) => (
                <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[11px] whitespace-nowrap">
                  {t}
                </span>
              ))}
            </span>
          ),
          enableSorting: false,
          meta: { label: "Tech stack" },
        }),
        helper.accessor("tags", {
          header: "Tags",
          cell: ({ getValue }) => <span className="text-xs whitespace-nowrap text-muted-foreground">{getValue().join(", ") || "—"}</span>,
          filterFn: "arrIncludesSome",
          enableSorting: false,
          meta: { label: "Tags" },
        }),
        helper.accessor("country", {
          header: ({ column }) => <SortHeader column={column} title="Location" />,
          cell: ({ row }) => (
            <span className="whitespace-nowrap text-muted-foreground">
              {[row.original.hqLocation, row.original.country].filter(Boolean).join(", ") || "—"}
            </span>
          ),
          filterFn: "inSet",
          meta: { label: "Location" },
        }),
        helper.accessor("remotePolicy", {
          header: "Remote",
          cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() ? REMOTE_META[getValue()!].label : "—"}</span>,
          filterFn: "inSet",
          meta: { label: "Remote policy" },
        }),
        helper.accessor("size", { header: "Size", cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() ?? "—"}</span>, meta: { label: "Size" } }),
        helper.accessor("contacts", {
          header: ({ column }) => <SortHeader column={column} title="People" />,
          cell: ({ getValue }) => <span className="tabular">{getValue() || <span className="text-muted-foreground/60">0</span>}</span>,
          meta: { label: "Contacts", align: "end" },
        }),
        helper.accessor("activeOpportunities", {
          header: ({ column }) => <SortHeader column={column} title="Open roles" />,
          cell: ({ row }) => (
            <span className="tabular">
              {row.original.activeOpportunities}
              <span className="text-muted-foreground">/{row.original.opportunities}</span>
            </span>
          ),
          meta: { label: "Opportunities", align: "end" },
        }),
        helper.accessor("touchpoints", {
          header: ({ column }) => <SortHeader column={column} title="Touches" />,
          cell: ({ getValue }) => <span className="tabular">{getValue() || <span className="text-muted-foreground/60">0</span>}</span>,
          meta: { label: "Touchpoints", align: "end" },
        }),
        helper.accessor("lastActivityAt", {
          header: ({ column }) => <SortHeader column={column} title="Last activity" />,
          cell: ({ getValue }) => <RelativeTime value={getValue()} now={now} className="text-muted-foreground" />,
          sortUndefined: "last",
          sortFn: "basic",
          meta: { label: "Last activity" },
        }),
        helper.accessor("contacted", { header: "Contacted", filterFn: "inSet", meta: { label: "Contacted" } }),
        helper.accessor("recency", { header: "Recency", filterFn: "inSet", meta: { label: "Recency" } }),
        helper.accessor("createdAt", {
          header: ({ column }) => <SortHeader column={column} title="Added" />,
          cell: ({ getValue }) => <RelativeTime value={getValue()} now={now} className="text-muted-foreground" />,
          meta: { label: "Added" },
        }),
        helper.display({
          id: "actions",
          cell: ({ row }) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.name}`} className="opacity-60 group-hover/row:opacity-100">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/companies/${row.original.id}`}>Open</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => quickLog({ companyId: row.original.id })}>Log activity</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => deleteWithUndo("companies", [row.original.id], row.original.name)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
          enableHiding: false,
          meta: { className: "w-10 px-1" },
        }),
      ]),
    [now, quickLog],
  );

  return (
    <DataTable
      entity="companies"
      data={data}
      columns={columns}
      getRowId={(r) => String(r.id)}
      searchPlaceholder="Search companies, stacks, tags…"
      defaultVisibility={{ size: false, tags: false, contacted: false, recency: false, createdAt: false, remotePolicy: false }}
      defaultSorting={[{ id: "name", desc: false }]}
      facets={[
        { columnId: "tier", title: "Tier", options: options(TIER_META) },
        { columnId: "industry", title: "Industry", options: industries.map((i) => ({ value: i, label: i })) },
        { columnId: "country", title: "Country", options: countries.map((c) => ({ value: c, label: c })) },
        { columnId: "tags", title: "Tags", options: tags.map((t) => ({ value: t, label: t })) },
        {
          columnId: "recency",
          title: "Activity",
          options: [
            { value: "week", label: "Last 7 days" },
            { value: "month", label: "Last 30 days" },
            { value: "older", label: "Over 30 days ago" },
            { value: "never", label: "Never contacted" },
          ],
        },
      ]}
      views={[...BUILT_IN, ...views.map((v) => ({ id: v.id, name: v.name, state: v.state }))]}
      csv={{
        filename: "companies",
        columns: [
          { header: "Name", value: (r) => r.name },
          { header: "Website", value: (r) => r.website },
          { header: "LinkedIn", value: (r) => r.linkedinUrl },
          { header: "Tier", value: (r) => r.tier },
          { header: "Industry", value: (r) => r.industry },
          { header: "Size", value: (r) => r.size },
          { header: "HQ", value: (r) => r.hqLocation },
          { header: "Country", value: (r) => r.country },
          { header: "Timezone", value: (r) => r.timezone },
          { header: "Remote policy", value: (r) => r.remotePolicy },
          { header: "Tech stack", value: (r) => r.techStack },
          { header: "Tags", value: (r) => r.tags },
          { header: "Contacts", value: (r) => r.contacts },
          { header: "Opportunities", value: (r) => r.opportunities },
          { header: "Touchpoints", value: (r) => r.touchpoints },
          { header: "Last activity", value: (r) => iso(r.lastActivityAt) },
        ],
      }}
      importable
      primaryAction={
        <Button size="sm" className="h-8" onClick={addCompany}>
          <Plus data-icon="inline-start" />
          Company
        </Button>
      }
      bulkActions={(sel, clear) => <BulkTagButton entity="companies" ids={sel.map((r) => r.id)} onDone={clear} />}
      onDeleteRows={(sel, clear) => deleteWithUndo("companies", sel.map((r) => r.id), plural(sel.length, "company", "companies"), clear)}
      empty={
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Add the places you want to work — then log every application and message against them."
          action={
            <Button size="sm" onClick={addCompany}>
              <Plus data-icon="inline-start" />
              Add company
            </Button>
          }
        />
      }
    />
  );
}
