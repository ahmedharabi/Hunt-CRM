"use client";

import { useMemo } from "react";
import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import { Mail, MoreHorizontal, Plus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable, SortHeader, selectColumn, type TableView } from "@/components/data-table/data-table";
import { iso } from "@/components/data-table/csv";
import { CompanyAvatar } from "@/components/shared/company-avatar";
import { RelativeTime } from "@/components/shared/relative-time";
import { EmptyState } from "@/components/shared/empty-state";
import { LinkedInIcon } from "@/components/brand/icons";
import { useAppActions } from "@/components/quick-log/app-actions";
import { deleteWithUndo, plural } from "@/lib/client/mutate";
import type { ContactRow } from "@/lib/queries/records";
import type { SavedView } from "@/db/schema";
import { CONTACT_TYPE_META, options } from "@/lib/meta";
import { features } from "@/lib/table";

type Row = ContactRow & { search: string; recency: string };
const helper = createColumnHelper<typeof features, Row>();
const DAY = 86_400_000;

const BUILT_IN: TableView[] = [
  { name: "All people", builtIn: true, state: {} },
  { name: "Never contacted", builtIn: true, state: { columnFilters: [{ id: "recency", value: ["never"] }] } },
  { name: "Recruiters", builtIn: true, state: { columnFilters: [{ id: "contactType", value: ["recruiter"] }] } },
  { name: "Replied to me", builtIn: true, state: { sorting: [{ id: "replies", desc: true }] } },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function ContactsTable({ rows, views, now }: { rows: ContactRow[]; views: SavedView[]; now: number }) {
  const { addContact, quickLog } = useAppActions();
  const data = useMemo<Row[]>(
    () =>
      rows.map((r) => ({
        ...r,
        search: [r.name, r.role, r.email, r.companyName].join(" "),
        recency: !r.lastContactedAt ? "never" : now - r.lastContactedAt < 7 * DAY ? "week" : now - r.lastContactedAt < 30 * DAY ? "month" : "older",
      })),
    [rows, now],
  );
  const companies = useMemo(() => [...new Set(rows.map((r) => r.companyName).filter(Boolean) as string[])].sort(), [rows]);

  const columns = useMemo(
    () =>
      helper.columns([
        selectColumn<Row>(),
        helper.accessor("name", {
          id: "name",
          header: ({ column }) => <SortHeader column={column} title="Name" />,
          cell: ({ row }) => (
            <Link href={`/contacts/${row.original.id}`} className="group/link flex min-w-44 items-center gap-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[0.59375rem] font-semibold text-muted-foreground">
                {initials(row.original.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium group-hover/link:underline group-hover/link:underline-offset-2">{row.original.name}</span>
                {row.original.role && <span className="block truncate text-xs text-muted-foreground">{row.original.role}</span>}
              </span>
            </Link>
          ),
          sortFn: "text",
          enableHiding: false,
          meta: { label: "Name" },
        }),
        helper.accessor("companyName", {
          header: ({ column }) => <SortHeader column={column} title="Company" />,
          cell: ({ row }) =>
            row.original.companyId ? (
              <Link href={`/companies/${row.original.companyId}`} className="flex items-center gap-2 whitespace-nowrap hover:underline hover:underline-offset-2">
                <CompanyAvatar name={row.original.companyName!} className="size-5 rounded text-[0.5rem]" />
                {row.original.companyName}
              </Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
          filterFn: "inSet",
          meta: { label: "Company" },
        }),
        helper.accessor("contactType", {
          header: "Type",
          cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{getValue() ? CONTACT_TYPE_META[getValue()!].label : "—"}</span>,
          filterFn: "inSet",
          meta: { label: "Type" },
        }),
        helper.display({
          id: "links",
          header: "Reach",
          cell: ({ row }) => (
            <span className="flex items-center gap-0.5">
              {row.original.email ? (
                <a href={`mailto:${row.original.email}`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title={row.original.email} aria-label={`Email ${row.original.name}`}>
                  <Mail className="size-3.5" />
                </a>
              ) : (
                <span className="p-1 text-muted-foreground/30"><Mail className="size-3.5" /></span>
              )}
              {row.original.linkedinUrl ? (
                <a href={row.original.linkedinUrl} target="_blank" rel="noreferrer" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`${row.original.name} on LinkedIn`}>
                  <LinkedInIcon className="size-3.5" />
                </a>
              ) : (
                <span className="p-1 text-muted-foreground/30"><LinkedInIcon className="size-3.5" /></span>
              )}
            </span>
          ),
          meta: { label: "Reach" },
        }),
        helper.accessor("touchpoints", {
          header: ({ column }) => <SortHeader column={column} title="Sent" />,
          cell: ({ getValue }) => <span className="tabular">{getValue() || <span className="text-muted-foreground/60">0</span>}</span>,
          meta: { label: "Messages sent", align: "end" },
        }),
        helper.accessor("replies", {
          header: ({ column }) => <SortHeader column={column} title="Replies" />,
          cell: ({ getValue }) => <span className="tabular">{getValue() || <span className="text-muted-foreground/60">0</span>}</span>,
          meta: { label: "Replies", align: "end" },
        }),
        helper.accessor("lastContactedAt", {
          header: ({ column }) => <SortHeader column={column} title="Last contacted" />,
          cell: ({ getValue }) => <RelativeTime value={getValue()} now={now} className="text-muted-foreground" />,
          sortUndefined: "last",
          sortFn: "basic",
          meta: { label: "Last contacted" },
        }),
        helper.accessor("recency", { header: "Recency", filterFn: "inSet", meta: { label: "Recency" } }),
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
                  <Link href={`/contacts/${row.original.id}`}>Open</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => quickLog({ type: "linkedin_dm", companyId: row.original.companyId, contactId: row.original.id })}>
                  Log message
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => deleteWithUndo("contacts", [row.original.id], row.original.name)}>
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
      entity="contacts"
      data={data}
      columns={columns}
      getRowId={(r) => String(r.id)}
      searchPlaceholder="Search people, roles, emails…"
      defaultVisibility={{ recency: false }}
      defaultSorting={[{ id: "lastContactedAt", desc: true }]}
      facets={[
        { columnId: "contactType", title: "Type", options: options(CONTACT_TYPE_META) },
        { columnId: "companyName", title: "Company", options: companies.map((c) => ({ value: c, label: c })) },
        {
          columnId: "recency",
          title: "Last contacted",
          options: [
            { value: "week", label: "Last 7 days" },
            { value: "month", label: "Last 30 days" },
            { value: "older", label: "Over 30 days ago" },
            { value: "never", label: "Never" },
          ],
        },
      ]}
      views={[...BUILT_IN, ...views.map((v) => ({ id: v.id, name: v.name, state: v.state }))]}
      csv={{
        filename: "contacts",
        columns: [
          { header: "Name", value: (r) => r.name },
          { header: "Company", value: (r) => r.companyName },
          { header: "Role", value: (r) => r.role },
          { header: "Type", value: (r) => r.contactType },
          { header: "Email", value: (r) => r.email },
          { header: "LinkedIn", value: (r) => r.linkedinUrl },
          { header: "Messages sent", value: (r) => r.touchpoints },
          { header: "Replies", value: (r) => r.replies },
          { header: "Last contacted", value: (r) => iso(r.lastContactedAt) },
        ],
      }}
      importable
      primaryAction={
        <Button size="sm" className="h-8" onClick={() => addContact()}>
          <Plus data-icon="inline-start" />
          Contact
        </Button>
      }
      onDeleteRows={(sel, clear) => deleteWithUndo("contacts", sel.map((r) => r.id), plural(sel.length, "contact"), clear)}
      empty={
        <EmptyState
          icon={UsersRound}
          title="No contacts yet"
          description="Recruiters, engineers and founders you talk to. Create them here or right from the quick-log dialog."
          action={
            <Button size="sm" onClick={() => addContact()}>
              <Plus data-icon="inline-start" />
              Add contact
            </Button>
          }
        />
      }
    />
  );
}
