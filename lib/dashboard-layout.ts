import { ACTIVITY_TYPES } from "./domain";

/**
 * The dashboard is a list of widgets the user can reorder, resize, rename,
 * hide and configure. The saved layout lives in settings.dashboard_layout;
 * `normalizeLayout` reconciles it with the widgets and options this version
 * knows about, so changing them in code never breaks a stored layout.
 */

export const WIDGET_IDS = ["today", "week", "followUps", "upcoming", "heatmap", "recent", "pipeline", "notes"] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];

/** Columns on a large screen, out of 3. Phones always stack. */
export const WIDGET_SIZES = ["narrow", "wide", "full"] as const;
export type WidgetSize = (typeof WIDGET_SIZES)[number];

type Choice = { value: string; label: string };

/** Each option renders as a control in the widget's settings popover. */
export type OptionSpec =
  | { key: string; label: string; type: "select"; choices: Choice[]; default: string }
  | { key: string; label: string; type: "toggle"; default: boolean }
  | { key: string; label: string; type: "multi"; choices: Choice[]; default: string[] };

export type OptionValue = string | boolean | string[];
export type WidgetOptions = Record<string, OptionValue>;

export type LayoutItem = {
  id: WidgetId;
  size: WidgetSize;
  hidden: boolean;
  /** Custom heading; null uses the widget's own. */
  title: string | null;
  options: WidgetOptions;
};
export type DashboardLayout = LayoutItem[];

const counts = (...n: number[]): Choice[] => n.map((v) => ({ value: String(v), label: String(v) }));

/** "activity" choices get their labels from ACTIVITY_META in the UI. */
const ACTIVITY_CHOICES: Choice[] = ACTIVITY_TYPES.map((t) => ({ value: t, label: t }));

export const WIDGET_META: Record<WidgetId, { label: string; description: string; size: WidgetSize; hidden?: boolean; options: OptionSpec[] }> = {
  today: {
    label: "Today",
    description: "Progress rings for each daily goal",
    size: "full",
    options: [
      { key: "types", label: "Goals shown", type: "multi", choices: ACTIVITY_CHOICES, default: [...ACTIVITY_TYPES] },
      { key: "extra", label: "Show other activity logged today", type: "toggle", default: true },
    ],
  },
  week: {
    label: "This week",
    description: "Outreach, replies, applications and LinkedIn connections vs last week",
    size: "full",
    options: [
      {
        key: "stats",
        label: "Numbers shown",
        type: "multi",
        choices: [
          { value: "outreach", label: "Outreach" },
          { value: "replies", label: "Replies" },
          { value: "applications", label: "Applications" },
          { value: "linkedin", label: "LinkedIn connections" },
        ],
        default: ["outreach", "replies", "applications", "linkedin"],
      },
      { key: "compare", label: "Compare with last week", type: "toggle", default: true },
    ],
  },
  followUps: {
    label: "Follow-ups",
    description: "Follow-ups that are due, with quick actions",
    size: "wide",
    options: [
      {
        key: "range",
        label: "Show",
        type: "select",
        choices: [
          { value: "due", label: "Due now" },
          { value: "week", label: "All this week" },
        ],
        default: "due",
      },
      { key: "limit", label: "Rows", type: "select", choices: counts(5, 8, 12, 20), default: "8" },
    ],
  },
  upcoming: {
    label: "Upcoming",
    description: "Interviews and application deadlines ahead",
    size: "narrow",
    options: [
      {
        key: "days",
        label: "Look ahead",
        type: "select",
        choices: [
          { value: "3", label: "3 days" },
          { value: "7", label: "7 days" },
          { value: "14", label: "2 weeks" },
          { value: "30", label: "30 days" },
        ],
        default: "7",
      },
      {
        key: "show",
        label: "Include",
        type: "multi",
        choices: [
          { value: "interviews", label: "Interviews" },
          { value: "deadlines", label: "Deadlines" },
        ],
        default: ["interviews", "deadlines"],
      },
    ],
  },
  heatmap: {
    label: "Activity heatmap",
    description: "Your activity day by day, and this week's targets",
    size: "full",
    options: [
      {
        key: "months",
        label: "Period",
        type: "select",
        choices: [
          { value: "3", label: "3 months" },
          { value: "6", label: "6 months" },
          { value: "12", label: "12 months" },
        ],
        default: "6",
      },
      { key: "targets", label: "Show this week's targets", type: "toggle", default: true },
    ],
  },
  recent: {
    label: "Recent activity",
    description: "Your latest touchpoints",
    size: "wide",
    options: [
      { key: "limit", label: "Rows", type: "select", choices: counts(5, 8, 12, 20), default: "12" },
      {
        key: "direction",
        label: "Include",
        type: "multi",
        choices: [
          { value: "outbound", label: "What you sent" },
          { value: "inbound", label: "Replies received" },
        ],
        default: ["outbound", "inbound"],
      },
    ],
  },
  pipeline: {
    label: "Pipeline",
    description: "Open applications by stage",
    size: "narrow",
    options: [
      { key: "bar", label: "Show the stage bar", type: "toggle", default: true },
      { key: "closed", label: "Show closed applications", type: "toggle", default: true },
    ],
  },
  notes: {
    label: "Pinned notes",
    description: "Notes you pinned on the Notes page",
    size: "narrow",
    hidden: true,
    options: [
      { key: "limit", label: "Notes", type: "select", choices: counts(3, 5, 10), default: "5" },
      { key: "preview", label: "Show a preview line", type: "toggle", default: true },
    ],
  },
};

export const SIZE_META: Record<WidgetSize, { label: string; span: string }> = {
  narrow: { label: "⅓ width", span: "lg:col-span-1" },
  wide: { label: "⅔ width", span: "lg:col-span-2" },
  full: { label: "Full width", span: "lg:col-span-3" },
};

export function defaultOptions(id: WidgetId): WidgetOptions {
  return Object.fromEntries(WIDGET_META[id].options.map((o) => [o.key, o.default]));
}

export function defaultItem(id: WidgetId): LayoutItem {
  return { id, size: WIDGET_META[id].size, hidden: !!WIDGET_META[id].hidden, title: null, options: defaultOptions(id) };
}

export const DEFAULT_LAYOUT: DashboardLayout = WIDGET_IDS.map(defaultItem);

/** Keep valid option values; anything unknown or malformed falls back to the default. */
function normalizeOptions(id: WidgetId, saved: unknown): WidgetOptions {
  const raw = (saved && typeof saved === "object" ? saved : {}) as Record<string, unknown>;
  const out: WidgetOptions = {};
  for (const spec of WIDGET_META[id].options) {
    const v = raw[spec.key];
    const allowed = spec.type === "toggle" ? null : new Set(spec.choices.map((c) => c.value));
    if (spec.type === "toggle") out[spec.key] = typeof v === "boolean" ? v : spec.default;
    else if (spec.type === "select") out[spec.key] = typeof v === "string" && allowed!.has(v) ? v : spec.default;
    else out[spec.key] = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && allowed!.has(x)) : spec.default;
  }
  return out;
}

/** Keep known widgets in their saved order, drop unknown ones, append new ones (hidden if they're opt-in). */
export function normalizeLayout(saved: unknown): DashboardLayout {
  if (!Array.isArray(saved)) return DEFAULT_LAYOUT;
  const seen = new Set<WidgetId>();
  const items: DashboardLayout = [];
  for (const raw of saved) {
    const id = raw?.id as WidgetId;
    if (!WIDGET_IDS.includes(id) || seen.has(id)) continue;
    seen.add(id);
    const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 60) : "";
    items.push({
      id,
      size: WIDGET_SIZES.includes(raw.size) ? raw.size : WIDGET_META[id].size,
      hidden: raw.hidden === true,
      title: title || null,
      options: normalizeOptions(id, raw.options),
    });
  }
  for (const item of DEFAULT_LAYOUT) if (!seen.has(item.id)) items.push(item);
  return items;
}

/** Typed readers for a widget's options (values are already normalized). */
export const opt = {
  str: (o: WidgetOptions, key: string) => o[key] as string,
  num: (o: WidgetOptions, key: string) => Number(o[key]),
  bool: (o: WidgetOptions, key: string) => o[key] as boolean,
  list: (o: WidgetOptions, key: string) => o[key] as string[],
};
