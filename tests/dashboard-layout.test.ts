import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, defaultOptions, normalizeLayout, WIDGET_IDS } from "@/lib/dashboard-layout";
import { dashboardLayoutSchema } from "@/lib/validators";

describe("dashboard layout", () => {
  it("falls back to the default when nothing is saved", () => {
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout("junk")).toEqual(DEFAULT_LAYOUT);
  });

  it("keeps the saved order, sizes, titles and hidden flags", () => {
    const layout = normalizeLayout([
      { id: "pipeline", size: "full", hidden: false, title: "  My pipeline " },
      { id: "today", size: "narrow", hidden: true },
    ]);
    expect(layout[0]).toMatchObject({ id: "pipeline", size: "full", hidden: false, title: "My pipeline" });
    expect(layout[1]).toMatchObject({ id: "today", size: "narrow", hidden: true, title: null });
  });

  it("drops unknown and duplicate widgets and appends missing ones", () => {
    const layout = normalizeLayout([
      { id: "gone", size: "full", hidden: false },
      { id: "recent", size: "huge", hidden: false },
      { id: "recent", size: "full", hidden: true },
    ]);
    expect(layout.map((w) => w.id).sort()).toEqual([...WIDGET_IDS].sort());
    expect(layout[0]).toMatchObject({ id: "recent", size: "wide", hidden: false });
    // Opt-in widgets arrive hidden.
    expect(layout.find((w) => w.id === "notes")?.hidden).toBe(true);
  });

  it("keeps valid options and replaces invalid ones with defaults", () => {
    const [recent] = normalizeLayout([
      { id: "recent", size: "wide", hidden: false, options: { limit: "5", direction: ["inbound", "sideways"], extra: 1 } },
    ]);
    expect(recent.options).toEqual({ limit: "5", direction: ["inbound"] });

    const [pipeline] = normalizeLayout([{ id: "pipeline", size: "narrow", hidden: false, options: { bar: "yes", closed: false } }]);
    expect(pipeline.options).toEqual({ bar: true, closed: false });

    const [upcoming] = normalizeLayout([{ id: "upcoming", size: "narrow", hidden: false, options: { days: "99" } }]);
    expect(upcoming.options).toEqual(defaultOptions("upcoming"));
  });

  it("validates and normalizes what the client sends", () => {
    const parsed = dashboardLayoutSchema.parse([{ id: "heatmap", size: "full", hidden: false, title: "Grind", options: { months: "12", bogus: true } }]);
    expect(parsed[0]).toEqual({ id: "heatmap", size: "full", hidden: false, title: "Grind", options: { months: "12", targets: true } });
    expect(() => dashboardLayoutSchema.parse([{ id: "nope", size: "full", hidden: false }])).toThrow();
  });
});
