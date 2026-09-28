"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { saveColorTheme } from "@/lib/actions/misc";
import { COLOR_THEMES } from "@/lib/themes";
import { cn } from "@/lib/utils";

type Swatch = { bg: string; surface: string; fg: string; accent: string };

/** Approximations of the built-in zinc/orange look in globals.css, for the preview only. */
const DEFAULT_OPTION = {
  id: "default",
  label: "Default",
  flavors: "Zinc",
  light: { bg: "#fcfcfd", surface: "#ffffff", fg: "#27272a", accent: "#e2622b" },
  dark: { bg: "#141417", surface: "#1b1b1f", fg: "#f1f1f3", accent: "#f2873c" },
};

const OPTIONS = [
  DEFAULT_OPTION,
  ...COLOR_THEMES.map((t) => ({ id: t.id, label: t.label, flavors: `${t.light.name} / ${t.dark.name}`, light: t.light, dark: t.dark })),
];

/** Picks settings.colorTheme; the app layout re-renders with the new theme CSS. */
export function ColorThemePicker({ initial }: { initial: string }) {
  const [selected, setSelected] = useState(initial);
  const [, startTransition] = useTransition();

  const choose = (id: string) => {
    const previous = selected;
    setSelected(id);
    startTransition(async () => {
      const r = await saveColorTheme(id);
      if (!r.ok) {
        setSelected(previous);
        toast.error(r.error);
      }
    });
  };

  return (
    <div role="radiogroup" aria-label="Color theme" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {OPTIONS.map((o) => {
        const active = selected === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(o.id)}
            className={cn(
              "overflow-hidden rounded-lg border text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "border-foreground/40 ring-1 ring-foreground/20" : "hover:border-foreground/25",
            )}
          >
            <div className="flex h-14">
              <Preview s={o.light} />
              <Preview s={o.dark} />
            </div>
            <div className="flex items-center justify-between gap-2 border-t px-2.5 py-2">
              <div className="min-w-0">
                <div className="truncate text-[0.8125rem] font-medium">{o.label}</div>
                <div className="truncate text-[0.6875rem] text-muted-foreground">{o.flavors}</div>
              </div>
              {active && <Check className="size-3.5 shrink-0" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Preview({ s }: { s: Swatch }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-1.5 px-2.5" style={{ background: s.bg }}>
      <div className="flex items-center gap-1.5 rounded px-1.5 py-1" style={{ background: s.surface }}>
        <span className="size-2 shrink-0 rounded-full" style={{ background: s.accent }} />
        <span className="h-1 flex-1 rounded-full opacity-80" style={{ background: s.fg }} />
      </div>
      <span className="h-1 w-2/3 rounded-full opacity-40" style={{ background: s.fg }} />
    </div>
  );
}
