"use client";

import { useId } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ACTIVITY_META } from "@/lib/meta";
import { defaultOptions, SIZE_META, WIDGET_META, WIDGET_SIZES, type LayoutItem, type OptionSpec, type WidgetSize } from "@/lib/dashboard-layout";
import type { ActivityType } from "@/lib/domain";

/** Make the chosen option obvious; outline toggles are too subtle here. */
const ON = "data-[state=on]:border-brand/50 data-[state=on]:bg-brand-soft data-[state=on]:text-brand";

/** The body of a widget's settings popover: title, width, then the widget's own options. */
export function WidgetSettings({ item, onChange }: { item: LayoutItem; onChange: (patch: Partial<LayoutItem>) => void }) {
  const meta = WIDGET_META[item.id];
  const id = useId();
  const setOption = (key: string, value: LayoutItem["options"][string]) => onChange({ options: { ...item.options, [key]: value } });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">{meta.label}</p>
        <p className="text-xs text-muted-foreground">{meta.description}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-title`}>Title</Label>
        <Input
          id={`${id}-title`}
          value={item.title ?? ""}
          onChange={(e) => onChange({ title: e.target.value.slice(0, 60) || null })}
          placeholder={meta.label}
          className="h-8"
        />
      </div>

      <Field label="Width on large screens">
        <ToggleGroup type="single" variant="outline" size="sm" value={item.size} onValueChange={(v) => v && onChange({ size: v as WidgetSize })}>
          {WIDGET_SIZES.map((s) => (
            <ToggleGroupItem key={s} value={s} className={ON}>
              {SIZE_META[s].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      {meta.options.map((spec) => (
        <OptionControl key={spec.key} spec={spec} value={item.options[spec.key]} onChange={(v) => setOption(spec.key, v)} />
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground"
        onClick={() => onChange({ title: null, size: meta.size, options: defaultOptions(item.id) })}
      >
        <RotateCcw data-icon="inline-start" />
        Reset this block
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

function choiceLabel(value: string, label: string) {
  return value in ACTIVITY_META ? ACTIVITY_META[value as ActivityType].label : label;
}

function OptionControl({ spec, value, onChange }: { spec: OptionSpec; value: unknown; onChange: (v: string | boolean | string[]) => void }) {
  const id = useId();

  if (spec.type === "toggle") {
    return (
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="font-normal">
          {spec.label}
        </Label>
        <Switch id={id} checked={value as boolean} onCheckedChange={onChange} />
      </div>
    );
  }

  if (spec.type === "select") {
    return (
      <Field label={spec.label}>
        <ToggleGroup type="single" variant="outline" size="sm" value={value as string} onValueChange={(v) => v && onChange(v)} className="flex-wrap">
          {spec.choices.map((c) => (
            <ToggleGroupItem key={c.value} value={c.value} className={ON}>
              {c.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
    );
  }

  const selected = new Set(value as string[]);
  return (
    <Field label={spec.label}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {spec.choices.map((c) => (
          <label key={c.value} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.has(c.value)}
              onCheckedChange={(on) =>
                // Keep the spec's order so the widget's contents don't reshuffle.
                onChange(spec.choices.map((x) => x.value).filter((v) => (v === c.value ? on === true : selected.has(v))))
              }
            />
            <span className="truncate">{choiceLabel(c.value, c.label)}</span>
          </label>
        ))}
      </div>
    </Field>
  );
}
