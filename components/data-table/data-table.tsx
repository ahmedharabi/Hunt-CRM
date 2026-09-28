"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type Table,
  type ColumnVisibilityState as VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ListFilter,
  Plus,
  Save,
  Search,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table as UITable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteView, saveView } from "@/lib/actions/misc";
import type { SavedViewEntity } from "@/db/schema";
import { features, type Features, type TableViewState } from "@/lib/table";
import { cn } from "@/lib/utils";
import { downloadCsv, type CsvColumn } from "./csv";
import { CsvImportDialog } from "./csv-import";

export type Facet = {
  columnId: string;
  title: string;
  options: { value: string; label: string; color?: string; icon?: React.ReactNode }[];
};

export type TableView = { id?: number; name: string; state: TableViewState; builtIn?: boolean };

const STORAGE_PREFIX = "hunt.table.visibility.";

function readVisibility(entity: string): VisibilityState | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + entity);
    return raw ? (JSON.parse(raw) as VisibilityState) : null;
  } catch {
    return null;
  }
}

export function DataTable<TData extends Record<string, unknown>>({
  entity,
  data,
  columns,
  facets = [],
  searchPlaceholder = "Search…",
  views = [],
  defaultVisibility = {},
  defaultSorting = [],
  getRowId,
  bulkActions,
  primaryAction,
  csv,
  importable,
  empty,
  onDeleteRows,
}: {
  entity: SavedViewEntity;
  data: TData[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous column value types
  columns: ColumnDef<Features, TData, any>[];
  facets?: Facet[];
  searchPlaceholder?: string;
  views?: TableView[];
  defaultVisibility?: VisibilityState;
  defaultSorting?: SortingState;
  getRowId: (row: TData) => string;
  bulkActions?: (rows: TData[], clear: () => void) => React.ReactNode;
  primaryAction?: React.ReactNode;
  csv: { filename: string; columns: CsvColumn<TData>[] };
  importable?: boolean;
  empty: React.ReactNode;
  onDeleteRows?: (rows: TData[], clear: () => void) => void;
}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>(defaultSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaultVisibility);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });
  const [activeView, setActiveView] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Column visibility is a per-browser preference.
  useEffect(() => {
    const saved = readVisibility(entity);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    if (saved) setColumnVisibility((v: VisibilityState) => ({ ...v, ...saved }));
  }, [entity]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + entity, JSON.stringify(columnVisibility));
    } catch {
      /* private mode */
    }
  }, [entity, columnVisibility]);

  const firstColumnId = columns.find((c) => c.id !== "select")?.id;

  const table = useTable({
    features,
    data,
    columns,
    getRowId: (row) => getRowId(row),
    state: { sorting, columnFilters, globalFilter, columnVisibility, rowSelection, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: (u) => {
      setColumnFilters(u);
      setActiveView(null);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    onGlobalFilterChange: (u) => {
      setGlobalFilter(u);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    enableRowSelection: true,
    // The search box matches the precomputed `search` text on each row.
    getColumnCanGlobalFilter: (column) => column.id === firstColumnId,
    globalFilterFn: (row, _columnId, value: string) => {
      const hay = String((row.original as { search?: string }).search ?? "").toLowerCase();
      return value
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((t) => hay.includes(t));
    },
  });

  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const clearSelection = () => setRowSelection({});
  const filteredCount = table.getFilteredRowModel().rows.length;
  const isFiltered = columnFilters.length > 0 || !!globalFilter;

  const applyView = (view: TableView) => {
    setColumnFilters(view.state.columnFilters ?? []);
    setGlobalFilter(view.state.globalFilter ?? "");
    setSorting(view.state.sorting ?? defaultSorting);
    if (view.state.columnVisibility) setColumnVisibility({ ...defaultVisibility, ...view.state.columnVisibility });
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setActiveView(view.name);
  };

  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const saveCurrentView = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewName.trim()) return;
    const r = await saveView({ entity, name: viewName.trim(), state: { columnFilters, globalFilter, sorting, columnVisibility } });
    if (r.ok) {
      toast.success(`Saved view “${r.data.name}”`);
      setActiveView(r.data.name);
      setSaveOpen(false);
      setViewName("");
      router.refresh();
    } else toast.error(r.error);
  };

  const exportRows = () => {
    const rows = table.getSortedRowModel().rows.map((r) => r.original);
    downloadCsv(csv.filename, csv.columns, selected.length ? selected : rows);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 pl-8"
            aria-label="Search table"
          />
        </div>
        {facets.map((f) => {
          const column = table.getColumn(f.columnId);
          return column ? <FacetFilter key={f.columnId} column={column} facet={f} /> : null;
        })}
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            onClick={() => {
              setColumnFilters([]);
              setGlobalFilter("");
              setActiveView(null);
            }}
          >
            Reset
            <X data-icon="inline-end" />
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <ViewsMenu views={views} active={activeView} onApply={applyView} onSave={() => setSaveOpen(true)} />
          <ColumnsMenu table={table} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8" aria-label="Import or export">
                <Download data-icon="inline-start" />
                <span className="hidden sm:inline">CSV</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={exportRows}>
                <Download />
                Export {selected.length ? `${selected.length} selected` : isFiltered ? `${filteredCount} filtered` : "all"}
              </DropdownMenuItem>
              {importable && (
                <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                  <Upload />
                  Import from CSV…
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {primaryAction}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <UITable className="text-[0.8125rem]">
            <TableHeader className="bg-muted/40 [&_tr]:border-b">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id} className="hover:bg-transparent">
                  {group.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "h-9 px-3 text-xs font-medium whitespace-nowrap text-muted-foreground",
                        header.column.columnDef.meta?.align === "end" && "text-right",
                        header.column.columnDef.meta?.className,
                      )}
                    >
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined} className="group/row">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "h-11 px-3 py-1.5",
                          cell.column.columnDef.meta?.align === "end" && "text-right",
                          cell.column.columnDef.meta?.className,
                        )}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={table.getVisibleLeafColumns().length} className="p-0">
                    {data.length === 0 ? (
                      empty
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-14 text-center">
                        <ListFilter className="size-5 text-muted-foreground" strokeWidth={1.75} />
                        <p className="text-sm text-muted-foreground">No rows match these filters.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setColumnFilters([]);
                            setGlobalFilter("");
                          }}
                        >
                          Clear filters
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </UITable>
        </div>
        <Pagination table={table} total={data.length} filtered={filteredCount} />
      </div>

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 md:bottom-6">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-popover p-1.5 pl-3 shadow-lg">
            <span className="tabular mr-1 text-[0.8125rem] font-medium">{selected.length} selected</span>
            {bulkActions?.(selected, clearSelection)}
            {onDeleteRows && (
              <Button variant="destructive" size="sm" onClick={() => onDeleteRows(selected, clearSelection)}>
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" onClick={clearSelection} aria-label="Clear selection">
              <X />
            </Button>
          </div>
        </div>
      )}

      {importable && <CsvImportDialog entity={entity} open={importOpen} onOpenChange={setImportOpen} />}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
            <DialogDescription>Keeps the current filters, search, sorting and columns.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveCurrentView} className="space-y-4">
            <Input
              autoFocus
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="e.g. Dream companies, no reply"
              aria-label="View name"
              className="h-9"
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!viewName.trim()}>
                Save view
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────────── pieces ─────────────────────────── */

export function SortHeader<TData extends Record<string, unknown>>({
  column,
  title,
  className,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any accessor value type
  column: Column<Features, TData, any>;
  title: string;
  className?: string;
}) {
  const dir = column.getIsSorted();
  const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(dir === "asc")}
      className={cn(
        "-ml-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs font-medium hover:bg-muted hover:text-foreground",
        dir && "text-foreground",
        className,
      )}
      aria-label={`Sort by ${title}`}
    >
      {title}
      <Icon className={cn("size-3", !dir && "opacity-40")} />
    </button>
  );
}

export function selectColumn<TData extends Record<string, unknown>>(): ColumnDef<Features, TData, unknown> {
  return {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all on this page"
        checked={
          table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false
        }
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        className="translate-y-px"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label="Select row"
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        className="translate-y-px"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    meta: { className: "w-9 pr-0" },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any accessor value type
function FacetFilter<TData extends Record<string, unknown>>({ column, facet }: { column: Column<Features, TData, any>; facet: Facet }) {
  const counts = column.getFacetedUniqueValues();
  const selected = new Set((column.getFilterValue() as string[] | undefined) ?? []);
  const setSelected = (next: Set<string>) => column.setFilterValue(next.size ? [...next] : undefined);
  // Facets over array values (tags) need per-element counts.
  const countFor = (value: string) => {
    let n = 0;
    for (const [k, c] of counts) {
      if (Array.isArray(k) ? k.map(String).includes(value) : String(k) === value) n += c;
    }
    return n;
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 border-dashed", selected.size && "border-solid")}>
          <Plus data-icon="inline-start" className={cn(selected.size && "hidden")} />
          {facet.title}
          {selected.size > 0 && (
            <span className="ml-0.5 flex gap-1">
              {selected.size > 2 ? (
                <span className="rounded bg-muted px-1.5 text-[0.6875rem]">{selected.size} selected</span>
              ) : (
                facet.options
                  .filter((o) => selected.has(o.value))
                  .map((o) => (
                    <span key={o.value} className="rounded bg-muted px-1.5 text-[0.6875rem]">
                      {o.label}
                    </span>
                  ))
              )}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={facet.title} />
          <CommandList>
            <CommandEmpty>No options</CommandEmpty>
            <CommandGroup>
              {facet.options.map((o) => {
                const on = selected.has(o.value);
                return (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onSelect={() => {
                      const next = new Set(selected);
                      if (on) next.delete(o.value);
                      else next.add(o.value);
                      setSelected(next);
                    }}
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-[4px] border",
                        on && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {on && <Check className="size-3" />}
                    </span>
                    {o.color && <span className="size-2 rounded-full" style={{ backgroundColor: o.color }} />}
                    {o.icon}
                    <span className="truncate">{o.label}</span>
                    <span className="tabular ml-auto text-xs text-muted-foreground">{countFor(o.value) || ""}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => setSelected(new Set())} className="justify-center text-center">
                    Clear filter
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ViewsMenu({
  views,
  active,
  onApply,
  onSave,
}: {
  views: TableView[];
  active: string | null;
  onApply: (v: TableView) => void;
  onSave: () => void;
}) {
  const router = useRouter();
  const builtIn = views.filter((v) => v.builtIn);
  const saved = views.filter((v) => !v.builtIn);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Bookmark data-icon="inline-start" />
          <span className="hidden max-w-40 truncate sm:inline">{active ?? "Views"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {builtIn.length > 0 && <DropdownMenuLabel className="text-xs text-muted-foreground">Suggested</DropdownMenuLabel>}
        {builtIn.map((v) => (
          <DropdownMenuItem key={v.name} onSelect={() => onApply(v)}>
            {active === v.name ? <Check /> : <span className="size-4" />}
            {v.name}
          </DropdownMenuItem>
        ))}
        {saved.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Saved</DropdownMenuLabel>
            {saved.map((v) => (
              <DropdownMenuItem key={v.id} onSelect={() => onApply(v)} className="group/item">
                {active === v.name ? <Check /> : <span className="size-4" />}
                <span className="flex-1 truncate">{v.name}</span>
                <button
                  type="button"
                  aria-label={`Delete view ${v.name}`}
                  className="rounded p-0.5 text-muted-foreground opacity-0 group-hover/item:opacity-100 hover:text-destructive focus-visible:opacity-100"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (v.id && (await deleteView(v.id)).ok) {
                      toast.success("View deleted");
                      router.refresh();
                    }
                  }}
                >
                  <X className="size-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSave}>
          <Save />
          Save current view…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ColumnsMenu<TData extends Record<string, unknown>>({ table }: { table: Table<Features, TData> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon-sm" className="size-8" aria-label="Choose columns">
          <Settings2 />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Columns</DropdownMenuLabel>
        {table
          .getAllLeafColumns()
          .filter((c) => c.getCanHide())
          .map((c) => (
            <DropdownMenuCheckboxItem
              key={c.id}
              checked={c.getIsVisible()}
              onCheckedChange={(v) => c.toggleVisibility(!!v)}
              onSelect={(e) => e.preventDefault()}
            >
              {c.columnDef.meta?.label ?? c.id}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Pagination<TData extends Record<string, unknown>>({
  table,
  total,
  filtered,
}: {
  table: Table<Features, TData>;
  total: number;
  filtered: number;
}) {
  const { pageIndex, pageSize } = table.store.state.pagination;
  const pageCount = Math.max(1, table.getPageCount());
  const from = filtered === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(filtered, (pageIndex + 1) * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
      <span className="tabular">
        {from}–{to} of {filtered}
        {filtered !== total && <span> (filtered from {total})</span>}
      </span>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
          <SelectTrigger size="sm" className="h-7 w-auto gap-1 text-xs" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[25, 50, 100, 250].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="tabular hidden sm:inline">
          Page {pageIndex + 1} of {pageCount}
        </span>
        <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export function useStableData<T>(data: T[]) {
  return useMemo(() => data, [data]);
}
