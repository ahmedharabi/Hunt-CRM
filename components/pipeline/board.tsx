"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Ban, Plus, Search, SquareKanban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompanyAvatar } from "@/components/shared/company-avatar";
import { PriorityBars, TierBadge } from "@/components/shared/badges";
import { NextStep } from "@/components/shared/next-step";
import { EmptyState } from "@/components/shared/empty-state";
import { useAppActions } from "@/components/quick-log/app-actions";
import { moveOpportunity } from "@/lib/actions/pipeline";
import { ACTIVE_STATUSES, canTransition, type OpportunityStatus } from "@/lib/domain";
import { REMOTE_META, SOURCE_META, STATUS_META, TIER_META } from "@/lib/meta";
import type { OpportunityRow } from "@/lib/queries/records";
import { cn } from "@/lib/utils";
import { FilterMenu } from "./filter-menu";

/**
 * The board shows four columns. Each is named after the status a card gets
 * when dropped on it, and also holds the neighbouring statuses so nothing
 * disappears (a screening card sits in Applied, a ghosted one in Rejected).
 * Wishlist roles aren't applied to yet, so they stay off the board.
 */
const BOARD = [
  { status: "applied", label: "Applied", holds: ["applied", "screening"] },
  { status: "interviewing", label: "Interview", holds: ["interviewing"] },
  { status: "offer", label: "Offer", holds: ["offer", "accepted"] },
  { status: "rejected", label: "Rejected", holds: ["rejected", "ghosted", "withdrawn"] },
] as const satisfies readonly { status: OpportunityStatus; label: string; holds: readonly OpportunityStatus[] }[];
type Column = (typeof BOARD)[number]["status"];
const COLUMNS = BOARD.map((c) => c.status);
const columnOf = (status: OpportunityStatus) => BOARD.find((c) => (c.holds as readonly string[]).includes(status))?.status;

type Columns = Record<Column, number[]>;
const DAY = 86_400_000;

function toColumns(rows: OpportunityRow[]): Columns {
  const cols = Object.fromEntries(COLUMNS.map((c) => [c, [] as number[]])) as Columns;
  for (const r of [...rows].sort((a, b) => a.position - b.position || a.id - b.id)) {
    const col = columnOf(r.status);
    if (col) cols[col].push(r.id);
  }
  return cols;
}

function findColumn(cols: Columns, id: number | string): Column | undefined {
  if (typeof id === "string" && (COLUMNS as readonly string[]).includes(id)) return id as Column;
  return COLUMNS.find((c) => cols[c].includes(Number(id)));
}

export function PipelineBoard({ rows, now }: { rows: OpportunityRow[]; now: number }) {
  const router = useRouter();
  const { addOpportunity } = useAppActions();
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const [columns, setColumns] = useState<Columns>(() => toColumns(rows));
  const [activeId, setActiveId] = useState<number | null>(null);
  // The dragged card's real status: it decides which columns accept the drop.
  const [origin, setOrigin] = useState<OpportunityStatus | null>(null);
  const snapshot = useRef<Columns | null>(null);

  // Server data changed (refresh after a mutation) — resync unless mid-drag.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync local optimistic state to fresh server data
    if (activeId === null) setColumns(toColumns(rows));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const [query, setQuery] = useState("");
  const [tiers, setTiers] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [modes, setModes] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const allTags = useMemo(() => [...new Set(rows.flatMap((r) => r.tags))].sort(), [rows]);

  const visible = (id: number) => {
    const r = byId.get(id);
    if (!r) return false;
    if (tiers.length && !tiers.includes(r.companyTier)) return false;
    if (sources.length && !sources.includes(r.source ?? "")) return false;
    if (modes.length && !modes.includes(r.workMode ?? "")) return false;
    if (tags.length && !r.tags.some((t) => tags.includes(t))) return false;
    if (query) {
      const hay = `${r.title} ${r.companyName} ${r.tags.join(" ")}`.toLowerCase();
      if (!query.toLowerCase().split(/\s+/).every((t) => hay.includes(t))) return false;
    }
    return true;
  };

  const accepts = (col: Column) => origin !== null && (columnOf(origin) === col || canTransition(origin, col));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => {
    const id = Number(e.active.id);
    setActiveId(id);
    setOrigin(byId.get(id)?.status ?? null);
    snapshot.current = columns;
  };

  // Move the card between columns live, but only into columns the rules allow.
  const onDragOver = (e: DragOverEvent) => {
    if (!e.over || origin === null) return;
    const from = findColumn(columns, e.active.id);
    const to = findColumn(columns, e.over.id);
    if (!from || !to || from === to) return;
    if (!accepts(to)) return;
    setColumns((prev) => {
      const id = Number(e.active.id);
      const target = prev[to].filter((x) => x !== id);
      const overIndex = target.indexOf(Number(e.over!.id));
      target.splice(overIndex >= 0 ? overIndex : target.length, 0, id);
      return { ...prev, [from]: prev[from].filter((x) => x !== id), [to]: target };
    });
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const id = Number(e.active.id);
    const from = origin;
    setActiveId(null);
    setOrigin(null);
    if (!from) return;
    const to = findColumn(columns, id);
    if (!to) return;
    const fromCol = columnOf(from);

    let next = columns;
    if (e.over && to === findColumn(columns, e.over.id)) {
      const oldIndex = columns[to].indexOf(id);
      const newIndex = columns[to].indexOf(Number(e.over.id));
      if (newIndex >= 0 && oldIndex !== newIndex) {
        next = { ...columns, [to]: arrayMove(columns[to], oldIndex, newIndex) };
        setColumns(next);
      }
    }
    const before = snapshot.current;
    if (to === fromCol && before && before[to].join() === next[to].join()) return;

    // Reordering inside a column keeps the card's own status (screening stays screening).
    const status = to === fromCol ? from : to;
    // Optimistic: the card already sits in its new place. Revert on failure.
    const r = await moveOpportunity(id, status, next[to]);
    if (!r.ok) {
      if (before) setColumns(before);
      toast.error(r.error);
      return;
    }
    if (status !== from) {
      const title = byId.get(id)?.title ?? "Opportunity";
      toast.success(`${title} → ${STATUS_META[status].label}`);
    }
    router.refresh();
  };

  const active = activeId !== null ? byId.get(activeId) : null;

  if (!rows.length) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon={SquareKanban}
          title="Your board is empty"
          description="Add a role you want, or log an application — it lands here automatically."
          action={
            <Button size="sm" onClick={() => addOpportunity()}>
              <Plus data-icon="inline-start" />
              New opportunity
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter cards…" className="h-8 pl-8" aria-label="Filter cards" />
        </div>
        <FilterMenu title="Tier" options={Object.entries(TIER_META).map(([v, m]) => ({ value: v, label: m.label }))} value={tiers} onChange={setTiers} />
        <FilterMenu title="Source" options={Object.entries(SOURCE_META).map(([v, m]) => ({ value: v, label: m.label }))} value={sources} onChange={setSources} />
        <FilterMenu title="Work mode" options={Object.entries(REMOTE_META).map(([v, m]) => ({ value: v, label: m.label }))} value={modes} onChange={setModes} />
        {allTags.length > 0 && <FilterMenu title="Tags" options={allTags.map((t) => ({ value: t, label: t }))} value={tags} onChange={setTags} />}
        <Button size="sm" className="ml-auto h-8" onClick={() => addOpportunity()}>
          <Plus data-icon="inline-start" />
          Opportunity
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => {
        if (snapshot.current) setColumns(snapshot.current);
        setActiveId(null);
        setOrigin(null);
      }}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
          {BOARD.map((col) => {
            const ids = columns[col.status].filter(visible);
            const blocked = origin !== null && !accepts(col.status);
            return <BoardColumn key={col.status} status={col.status} label={col.label} ids={ids} byId={byId} now={now} blocked={blocked} dragging={origin !== null} />;
          })}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
          {active ? <Card row={active} now={now} overlay /> : null}
        </DragOverlay>
      </DndContext>
      <p className="text-xs text-muted-foreground">
        Drag cards between stages — moves follow the pipeline rules and are recorded in status history. Keyboard: focus a card, press Space, use arrows, Space again.
      </p>
    </div>
  );
}

function BoardColumn({
  status,
  label,
  ids,
  byId,
  now,
  blocked,
  dragging,
}: {
  status: Column;
  label: string;
  ids: number[];
  byId: Map<number, OpportunityRow>;
  now: number;
  blocked: boolean;
  dragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: blocked });
  const meta = STATUS_META[status];
  const terminal = status === "rejected";
  return (
    <section
      ref={setNodeRef}
      aria-label={`${label} column`}
      className={cn(
        "flex w-[82vw] shrink-0 snap-start flex-col rounded-xl border bg-muted/30 transition-colors sm:w-72 lg:w-auto lg:min-w-0 lg:flex-1",
        terminal && "bg-muted/15",
        blocked && "opacity-45",
        isOver && !blocked && "border-foreground/25 bg-muted/60",
      )}
    >
      <header className="flex h-10 items-center gap-2 px-3">
        <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} />
        <h3 className="text-[0.8125rem] font-medium">{label}</h3>
        <span className="tabular text-xs text-muted-foreground">{ids.length}</span>
        {blocked && dragging && <Ban className="ml-auto size-3.5 text-muted-foreground" aria-label="Not allowed from here" />}
      </header>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
          {ids.map((id) => {
            const row = byId.get(id);
            return row ? <SortableCard key={id} row={row} now={now} /> : null;
          })}
          {ids.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed py-6 text-xs text-muted-foreground/70">
              {blocked ? "Can't move here" : "Drop here"}
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({ row, now }: { row: OpportunityRow; now: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable opportunity"
      className={cn("touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring", isDragging && "opacity-30")}
    >
      <Card row={row} now={now} />
    </div>
  );
}

function Card({ row, now, overlay }: { row: OpportunityRow; now: number; overlay?: boolean }) {
  const days = Math.floor((now - row.stageSince) / DAY);
  const stale = (ACTIVE_STATUSES as readonly string[]).includes(row.status) && row.status !== "wishlist" && row.status !== "accepted" && days >= 14;
  return (
    <article
      className={cn(
        "group/card cursor-grab rounded-lg border bg-card p-3 shadow-xs transition-shadow select-none hover:border-foreground/15 active:cursor-grabbing",
        overlay && "rotate-[1.5deg] cursor-grabbing shadow-lg ring-1 ring-foreground/10",
      )}
    >
      <div className="flex items-start gap-2.5">
        <CompanyAvatar name={row.companyName} logoUrl={row.companyLogo} className="size-7" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/opportunities/${row.id}`}
            className="line-clamp-2 text-[0.8125rem] leading-snug font-medium hover:underline hover:underline-offset-2"
            onPointerDown={(e) => e.stopPropagation()}
            draggable={false}
          >
            {row.title}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.companyName}</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <TierBadge tier={row.companyTier} />
        {columnOf(row.status) !== row.status && (
          <span className="rounded-md px-1.5 py-0.5 text-[0.6875rem]" style={{ color: STATUS_META[row.status].color, backgroundColor: `color-mix(in oklab, ${STATUS_META[row.status].color} 12%, transparent)` }}>
            {STATUS_META[row.status].label}
          </span>
        )}
        <span className={cn("tabular rounded-md px-1.5 py-0.5 text-[0.6875rem]", stale ? "bg-status-withdrawn/12 text-status-withdrawn" : "text-muted-foreground")} title="Days in this stage">
          {days}d in stage
        </span>
        <PriorityBars priority={row.priority} className="ml-auto" />
      </div>
      {(row.nextInterviewAt || row.nextFollowUpAt || (row.deadline && row.deadline >= now - DAY)) && (
        <div className="mt-2 border-t pt-2 text-xs">
          <NextStep nextInterviewAt={row.nextInterviewAt} nextFollowUpAt={row.nextFollowUpAt} deadline={row.deadline} now={now} />
        </div>
      )}
    </article>
  );
}
