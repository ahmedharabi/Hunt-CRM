"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useMounted } from "@/hooks/use-mounted";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, applyServerErrors } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { saveSettings } from "@/lib/actions/misc";
import { settingsSchema, type SettingsValues } from "@/lib/validators";
import { ACTIVITY_TYPES, OUTREACH_TYPES, type ActivityType } from "@/lib/domain";
import { ACTIVITY_META } from "@/lib/meta";
import type { Settings } from "@/db/schema";
import type { z } from "zod";
import { cn } from "@/lib/utils";
import { ColorThemePicker } from "./color-theme-picker";
import { TextSizeStepper } from "./text-size-stepper";

const TIMEZONES = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["Africa/Tunis", "UTC"];
const GOAL_TYPES: ActivityType[] = ["application", "cold_email", "linkedin_dm", "linkedin_connection", "follow_up", "referral_request", "call", "coffee_chat"];
const STREAK_TYPES: ActivityType[] = ["application", "cold_email", "linkedin_dm", "linkedin_connection", "follow_up"];
const RULE_TYPES: ActivityType[] = [...OUTREACH_TYPES, "follow_up"];

type Input_ = z.input<typeof settingsSchema>;

export function Section({ title, description, children, id }: { title: string; description?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="grid gap-4 border-b py-8 first:pt-0 last:border-0 md:grid-cols-[220px_1fr] md:gap-10">
      <div>
        <h3 className="text-[0.875rem] font-medium">{title}</h3>
        {description && <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const { theme: rawTheme, setTheme } = useTheme();
  const theme = useMounted() ? rawTheme : undefined;
  const fill = (m: Partial<Record<ActivityType, number>>) => Object.fromEntries(ACTIVITY_TYPES.map((t) => [t, m[t] ?? 0]));
  const { control, handleSubmit, setError, formState, reset } = useForm<Input_, unknown, SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      timezone: settings.timezone,
      weekStartsOn: settings.weekStartsOn,
      dailyGoals: fill(settings.dailyGoals),
      weeklyGoals: fill(settings.weeklyGoals),
      followUpRules: fill(settings.followUpRules),
      ghostingThresholdDays: settings.ghostingThresholdDays,
      linkedinWeeklyConnectionLimit: settings.linkedinWeeklyConnectionLimit,
      streakMode: settings.streakMode,
      streakGoals: fill(settings.streakGoals),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    // Zero means "no goal / no reminder": drop those keys.
    const clean = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).filter(([, v]) => v > 0));
    const r = await saveSettings({ ...values, dailyGoals: clean(values.dailyGoals), weeklyGoals: clean(values.weeklyGoals), followUpRules: clean(values.followUpRules), streakGoals: clean(values.streakGoals) });
    if (!r.ok) {
      applyServerErrors(setError, r.fieldErrors);
      toast.error(r.error);
      return;
    }
    toast.success("Settings saved");
    reset(values);
    router.refresh();
  });

  const numberGrid = (name: "dailyGoals" | "weeklyGoals" | "followUpRules" | "streakGoals", types: ActivityType[], suffix: string) => (
    <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
      {types.map((t) => {
        const Icon = ACTIVITY_META[t].icon;
        return (
          <FormField key={t} control={control} name={`${name}.${t}` as const}>
            {({ field, id }) => (
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={id} className="flex min-w-0 items-center gap-2 text-[0.8125rem]">
                  <Icon className="size-3.5 shrink-0" style={{ color: ACTIVITY_META[t].color }} />
                  <span className="truncate">{ACTIVITY_META[t].label}</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id={id}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={String(field.value ?? 0)}
                    onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                    className="tabular h-8 w-16 text-right"
                  />
                  <span className="w-8 text-xs text-muted-foreground">{suffix}</span>
                </div>
              </div>
            )}
          </FormField>
        );
      })}
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <Section title="Appearance" description="Light or dark is saved on this device; color theme and text size apply everywhere.">
        <div className="grid max-w-md grid-cols-3 gap-2">
          {[
            { value: "light", label: "Light", icon: Sun },
            { value: "dark", label: "Dark", icon: Moon },
            { value: "system", label: "System", icon: Monitor },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={theme === value}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border py-3 text-[0.8125rem] transition-colors",
                theme === value ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              <Icon className="size-4" strokeWidth={1.85} />
              {label}
            </button>
          ))}
        </div>
        <div className="mt-5 max-w-xl space-y-2">
          <span className="text-[0.8125rem]">Color theme</span>
          <ColorThemePicker initial={settings.colorTheme} />
        </div>
        <div className="mt-5 flex max-w-md items-center justify-between gap-3">
          <span className="text-[0.8125rem]">Text size</span>
          <TextSizeStepper initial={settings.textScale} />
        </div>
      </Section>

      <Section title="Time" description="Days, streaks and charts are bucketed in this timezone.">
        <div className="grid max-w-lg gap-4 sm:grid-cols-2">
          <FormField control={control} name="timezone" label="Timezone">
            {({ field, id, invalid }) => (
              <>
                <Input id={id} list="settings-tz" {...field} aria-invalid={invalid} className="h-9" />
                <datalist id="settings-tz">
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz} />
                  ))}
                </datalist>
              </>
            )}
          </FormField>
          <FormField control={control} name="weekStartsOn" label="Week starts on">
            {({ field, id }) => (
              <SelectField
                id={id}
                value={String(field.value)}
                onChange={(v) => field.onChange(Number(v))}
                options={[
                  { value: "1", label: "Monday" },
                  { value: "0", label: "Sunday" },
                  { value: "6", label: "Saturday" },
                ]}
              />
            )}
          </FormField>
        </div>
      </Section>

      <Section title="Daily goals" description="Progress rings on the dashboard. Set 0 to hide a type.">
        {numberGrid("dailyGoals", GOAL_TYPES, "/ day")}
      </Section>

      <Section title="Streak" description="What a day needs to keep your streak alive. Set 0 to leave a type out.">
        {numberGrid("streakGoals", STREAK_TYPES, "/ day")}
        <div className="mt-5 max-w-sm">
          <FormField control={control} name="streakMode" label="A day counts toward your streak when…">
            {({ field, id }) => (
              <SelectField
                id={id}
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "any_goal", label: "At least one target is hit" },
                  { value: "all_goals", label: "Every target is hit" },
                  { value: "any_activity", label: "Anything at all is logged" },
                ]}
              />
            )}
          </FormField>
        </div>
      </Section>

      <Section title="Weekly goals" description="Tracked in the weekly review and on the dashboard.">
        {numberGrid("weeklyGoals", GOAL_TYPES, "/ wk")}
      </Section>

      <Section title="Follow-ups" description="How long to wait before a reminder, per message type. 0 means never remind.">
        {numberGrid("followUpRules", RULE_TYPES, "days")}
        <div className="mt-5 grid max-w-lg gap-4 sm:grid-cols-2">
          <FormField control={control} name="ghostingThresholdDays" label="Ghosted after" description="Silent threads and stalled Applied/Screening roles close after this many days.">
            {({ field, id, invalid }) => (
              <div className="flex items-center gap-2">
                <Input id={id} type="number" min={3} value={String(field.value ?? "")} onChange={(e) => field.onChange(e.target.value)} aria-invalid={invalid} className="tabular h-9 w-20" />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            )}
          </FormField>
          <FormField control={control} name="linkedinWeeklyConnectionLimit" label="LinkedIn weekly limit" description="Connection requests per week before LinkedIn gets suspicious.">
            {({ field, id, invalid }) => (
              <Input id={id} type="number" min={1} value={String(field.value ?? "")} onChange={(e) => field.onChange(e.target.value)} aria-invalid={invalid} className="tabular h-9 w-24" />
            )}
          </FormField>
        </div>
      </Section>

      <div className="sticky bottom-20 z-10 -mx-1 flex justify-end md:bottom-4">
        <div className={cn("flex items-center gap-3 rounded-xl border bg-popover px-3 py-2 shadow-lg transition-opacity", formState.isDirty ? "opacity-100" : "pointer-events-none opacity-0")}>
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => reset()}>
            Discard
          </Button>
          <Button type="submit" size="sm" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <LoaderCircle className="animate-spin" />}
            Save settings
          </Button>
        </div>
      </div>
    </form>
  );
}
