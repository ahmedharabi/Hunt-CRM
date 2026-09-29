"use client";

import { Fragment, useEffect, useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, EyeOff, GripVertical, LayoutDashboard, LoaderCircle, Plus, RotateCcw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DashboardWidget, type WidgetData } from "@/components/dashboard/widgets";
import { WidgetSettings } from "@/components/dashboard/widget-settings";
import { saveDashboardLayout } from "@/lib/actions/misc";
import { DEFAULT_LAYOUT, SIZE_META, WIDGET_META, type DashboardLayout, type LayoutItem, type WidgetId } from "@/lib/dashboard-layout";
import { cn } from "@/lib/utils";

/**
 * Lays out the widgets in the user's order and sizes. "Customize" switches
 * to an edit mode: drag to reorder, open a block's settings to rename,
 * resize or change what it shows, hide it, or add hidden blocks back.
 * Every change previews live; nothing is saved until "Done".
 */
export function DashboardGrid({
  header,
  aside,
  notice,
  data,
  layout: initial,
}: {
  header: React.ReactNode;
  aside?: React.ReactNode;
  /** Shown under the header, e.g. what automation just tidied up. */
  notice?: React.ReactNode;
  data: WidgetData;
  layout: DashboardLayout;
}) {
  const [layout, setLayout] = useState(initial);
  const [draft, setDraft] = useState<DashboardLayout | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = draft !== null;
  const current = draft ?? layout;
  const visible = current.filter((w) => !w.hidden);
  const hidden = current.filter((w) => w.hidden);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const update = (id: WidgetId, patch: Partial<LayoutItem>) => setDraft((d) => d && d.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setDraft((d) => d && arrayMove(d, d.findIndex((w) => w.id === active.id), d.findIndex((w) => w.id === over.id)));
  };

  const addBack = (id: WidgetId) =>
    // Re-added widgets go to the end, where you'll see them land.
    setDraft((d) => d && [...d.filter((w) => w.id !== id), { ...d.find((w) => w.id === id)!, hidden: false }]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const result = await saveDashboardLayout(draft);
    setSaving(false);
    if (!result.ok) return void toast.error(result.error);
    setLayout(draft);
    setDraft(null);
    toast.success("Dashboard saved");
  };

  useEffect(() => {
    if (!editing) return;
    // Esc cancels, unless it's closing a popover first.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && setDraft(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  return (
    <>
      {/* Server-rendered slots are wrapped so React doesn't treat them as unkeyed list items. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Fragment key="header">{header}</Fragment>
        <div className="flex items-center gap-2">
          <Fragment key="aside">{aside}</Fragment>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setDraft(layout)}>
              <LayoutDashboard data-icon="inline-start" />
              Customize
            </Button>
          )}
        </div>
      </div>

      <Fragment key="notice">{notice}</Fragment>

      {editing && (
        <div className="sticky top-14 z-10 space-y-3 rounded-xl border border-brand/40 bg-card/95 p-3 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm">
              <span className="font-medium">Customize your dashboard.</span>{" "}
              <span className="text-muted-foreground">Drag to reorder. Use a block&apos;s settings to change what it shows.</span>
            </p>
            <Button variant="ghost" size="sm" onClick={() => setDraft(DEFAULT_LAYOUT)}>
              <RotateCcw data-icon="inline-start" />
              Reset all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Check data-icon="inline-start" />}
              Done
            </Button>
          </div>
          {hidden.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3" aria-label="Hidden blocks">
              <span className="text-xs text-muted-foreground">Add:</span>
              {hidden.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => addBack(w.id)}
                  title={WIDGET_META[w.id].description}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-solid hover:bg-muted hover:text-foreground"
                >
                  <Plus className="size-3.5" />
                  {w.title ?? WIDGET_META[w.id].label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="text-sm font-medium">Your dashboard is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {editing ? "Add blocks from the bar above." : "Customize it to add the blocks you want to see."}
          </p>
          {!editing && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setDraft(layout)}>
              <LayoutDashboard data-icon="inline-start" />
              Customize
            </Button>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={visible.map((w) => w.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-6 lg:grid-cols-3">
              {visible.map((w) => (
                <Widget key={w.id} item={w} editing={editing} onChange={(patch) => update(w.id, patch)}>
                  <DashboardWidget item={w} data={data} />
                </Widget>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </>
  );
}

function Widget({
  item,
  editing,
  onChange,
  children,
}: {
  item: LayoutItem;
  editing: boolean;
  onChange: (patch: Partial<LayoutItem>) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !editing });
  const label = item.title ?? WIDGET_META[item.id].label;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "@container relative flex min-w-0 flex-col [&>*:not([data-widget-toolbar])]:flex-1",
        SIZE_META[item.size].span,
        editing && "rounded-xl outline-2 outline-offset-4 outline-brand/40 outline-dashed",
        isDragging && "z-20 opacity-80 shadow-lg",
      )}
    >
      {editing && (
        <div data-widget-toolbar className="absolute -top-5 right-3 z-10 flex items-center gap-0.5 rounded-lg border bg-popover p-0.5 shadow-sm">
          <Button
            ref={setActivatorNodeRef}
            variant="ghost"
            size="icon-sm"
            className="cursor-grab touch-none active:cursor-grabbing"
            aria-label={`Move ${label}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Settings for ${label}`}>
                <SlidersHorizontal />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="max-h-[min(70svh,34rem)] w-80 overflow-y-auto">
              <WidgetSettings item={item} onChange={onChange} />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon-sm" aria-label={`Hide ${label}`} onClick={() => onChange({ hidden: true })}>
            <EyeOff />
          </Button>
        </div>
      )}
      {/* While editing, the widget is a preview: its links and buttons shouldn't fire. */}
      <div className={cn("flex min-w-0 flex-col [&>*]:flex-1", editing && "pointer-events-none select-none")} inert={editing || undefined}>
        {children}
      </div>
    </div>
  );
}
