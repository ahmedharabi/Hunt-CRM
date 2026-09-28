"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, LoaderCircle, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntityCombobox } from "@/components/shared/entity-combobox";
import { SelectField } from "@/components/shared/select-field";
import { DateTimeInput } from "@/components/shared/datetime-input";
import { CompanyAvatar } from "@/components/shared/company-avatar";
import { CompanyLocalTime, useNow } from "@/components/shared/local-time";
import { useLookups } from "@/components/providers/lookups";
import { usePrefs } from "@/components/providers/prefs";
import { checkRecentMessage } from "@/lib/actions/records";
import { logActivity } from "@/lib/actions/activities";
import { ACTIVITY_TYPES, OUTREACH_TYPES, type ActivityType, type Direction } from "@/lib/domain";
import { ACTIVITY_META, STATUS_META, TEMPLATE_TYPE_META } from "@/lib/meta";
import { formatTz, relativeShort } from "@/lib/dates";
import { activitySchema } from "@/lib/validators";
import { cn } from "@/lib/utils";

export type QuickLogPreset = {
  type?: ActivityType;
  companyId?: number | null;
  contactId?: number | null;
  opportunityId?: number | null;
  parentActivityId?: number | null;
  templateId?: number | null;
  subject?: string | null;
  summary?: string | null;
  direction?: Direction;
};

type State = {
  type: ActivityType;
  direction: Direction;
  companyId: number | null;
  newCompanyName: string | null;
  contactId: number | null;
  newContactName: string | null;
  opportunityId: number | null;
  newOpportunityTitle: string;
  newOpportunityCountry: string;
  parentActivityId: number | null;
  templateId: number | null;
  subject: string;
  summary: string;
  occurredAt: Date | null;
};

const initialState = (p: QuickLogPreset = {}): State => ({
  type: p.type ?? "cold_email",
  direction: p.direction ?? "outbound",
  companyId: p.companyId ?? null,
  newCompanyName: null,
  contactId: p.contactId ?? null,
  newContactName: null,
  opportunityId: p.opportunityId ?? null,
  newOpportunityTitle: "",
  newOpportunityCountry: "",
  parentActivityId: p.parentActivityId ?? null,
  templateId: p.templateId ?? null,
  subject: p.subject ?? "",
  summary: p.summary ?? "",
  occurredAt: null,
});

const SHORTCUT: Partial<Record<ActivityType, string>> = {
  application: "A",
  cold_email: "E",
  linkedin_dm: "L",
  linkedin_connection: "C",
  follow_up: "F",
};

export function QuickLogDialog({
  open,
  onOpenChange,
  preset,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  preset: QuickLogPreset;
}) {
  const { timezone } = usePrefs();
  const { data: lookups, refresh } = useLookups();
  const [s, setS] = useState<State>(() => initialState(preset));
  const [another, setAnother] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentCheck, setRecentCheck] = useState<{ contactId: number; hit: { type: ActivityType; occurredAt: Date } | null } | null>(null);
  const clock = useNow() ?? 0;

  // Reset whenever the dialog opens with a new preset (state adjusted during render, not in an effect).
  const [session, setSession] = useState({ open, preset });
  if (session.open !== open || session.preset !== preset) {
    setSession({ open, preset });
    if (open) {
      setS(initialState(preset));
      setError(null);
    }
  }

  const set = (patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch }));

  const company = lookups?.companies.find((c) => c.id === s.companyId);
  const companyOptions = useMemo(
    () =>
      (lookups?.companies ?? []).map((c) => ({
        value: c.id,
        label: c.name,
        hint: c.tier === "dream" ? "dream" : null,
        icon: <CompanyAvatar name={c.name} logoUrl={c.logoUrl} className="size-5 rounded text-[8px]" />,
      })),
    [lookups],
  );
  const contactOptions = useMemo(
    () =>
      // A company that doesn't exist yet has no contacts to pick from.
      s.newCompanyName
        ? []
        : (lookups?.contacts ?? [])
            .filter((c) => !s.companyId || c.companyId === s.companyId)
            .map((c) => ({ value: c.id, label: c.name, hint: c.role })),
    [lookups, s.companyId, s.newCompanyName],
  );
  const opportunityOptions = useMemo(
    () =>
      (lookups?.opportunities ?? [])
        .filter((o) => !s.companyId || o.companyId === s.companyId)
        .map((o) => ({ value: o.id, label: o.title, hint: STATUS_META[o.status].label })),
    [lookups, s.companyId],
  );
  const threadOptions = useMemo(
    () =>
      (lookups?.threads ?? [])
        .filter((t) => (!s.companyId || t.companyId === s.companyId) && (!s.contactId || t.contactId === s.contactId))
        .slice(0, 60)
        .map((t) => ({
          value: t.id,
          label: `${ACTIVITY_META[t.type].label}${t.contactName ? ` → ${t.contactName}` : ""}`,
          hint: clock ? relativeShort(t.occurredAt, clock, timezone) : null,
        })),
    [lookups, s.companyId, s.contactId, timezone, clock],
  );
  const templateOptions = useMemo(
    () =>
      (lookups?.templates ?? [])
        .filter((t) => TEMPLATE_TYPE_META[t.type as keyof typeof TEMPLATE_TYPE_META]?.activity === s.type)
        .map((t) => ({ value: String(t.id), label: t.name })),
    [lookups, s.type],
  );

  // Follow-ups default to the most recent open thread with this company/contact (derived, not stored).
  const suggestedThread =
    s.type === "follow_up" && s.companyId
      ? (lookups?.threads.find((t) => t.companyId === s.companyId && (!s.contactId || t.contactId === s.contactId) && t.outcome === "pending")?.id ?? null)
      : null;
  const parentId = s.parentActivityId ?? suggestedThread;

  // Guardrail: same contact messaged in the last 7 days.
  useEffect(() => {
    const contactId = s.contactId;
    if (!contactId || s.direction !== "outbound") return;
    let live = true;
    checkRecentMessage(contactId).then((r) => {
      if (live) setRecentCheck({ contactId, hit: r.ok && r.data ? { type: r.data.type, occurredAt: new Date(r.data.occurredAt) } : null });
    });
    return () => {
      live = false;
    };
  }, [s.contactId, s.direction]);
  const recent = s.direction === "outbound" && recentCheck?.contactId === s.contactId ? recentCheck.hit : null;

  const isEmailish = s.type === "cold_email" || s.type === "follow_up" || s.type === "referral_request";

  const submit = async () => {
    setError(null);
    const payload = {
      type: s.type,
      direction: s.direction,
      companyId: s.companyId,
      newCompanyName: s.companyId ? null : s.newCompanyName,
      contactId: s.contactId,
      newContactName: s.contactId ? null : s.newContactName,
      opportunityId: s.opportunityId,
      newOpportunityTitle: s.type === "application" && !s.opportunityId ? s.newOpportunityTitle : null,
      newOpportunityCountry: s.type === "application" && !s.opportunityId ? s.newOpportunityCountry : null,
      parentActivityId: s.type === "follow_up" || s.direction === "inbound" ? parentId : null,
      templateId: s.templateId,
      subject: s.subject,
      summary: s.summary,
      occurredAt: s.occurredAt,
    };
    const check = activitySchema.safeParse(payload);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Check the form");
      if (check.error.issues[0]?.path[0] === "companyId") focusCompany();
      return;
    }
    setSubmitting(true);
    const r = await logActivity(payload);
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    const name = company?.name ?? s.newCompanyName;
    const moved = r.data.statusChange ? ` · moved to ${STATUS_META[r.data.statusChange.to].label}` : "";
    const created = r.data.createdOpportunityId ? " · opportunity created" : "";
    toast.success(`Logged ${ACTIVITY_META[s.type].label.toLowerCase()}${name ? ` · ${name}` : ""}${moved}${created}`);
    // New records and the new thread should show up in the pickers.
    void refresh();
    if (another) {
      setS({ ...initialState({ type: s.type }) });
      requestAnimationFrame(focusCompany);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[8%] max-h-[88svh] translate-y-0 gap-0 overflow-y-auto p-0 sm:max-w-xl"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          }
        }}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          if (!s.companyId) requestAnimationFrame(focusCompany);
        }}
      >
        <DialogHeader className="px-4 pt-4 pb-3">
          <DialogTitle className="text-[15px]">Log activity</DialogTitle>
          <DialogDescription className="sr-only">Record a touchpoint with a company or contact.</DialogDescription>
        </DialogHeader>

        <div
          role="radiogroup"
          aria-label="Activity type"
          className="flex gap-1 overflow-x-auto border-y bg-muted/40 px-3 py-2 [scrollbar-width:none]"
        >
          {ACTIVITY_TYPES.map((t) => {
            const meta = ACTIVITY_META[t];
            const Icon = meta.icon;
            const active = s.type === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set({ type: t, templateId: null })}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-background text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" style={{ color: active ? meta.color : undefined }} strokeWidth={2} />
                {meta.short}
                {SHORTCUT[t] && !active && <span className="hidden font-mono text-[10px] text-muted-foreground/70 sm:inline">{SHORTCUT[t]}</span>}
              </button>
            );
          })}
        </div>

        <div className="space-y-3.5 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="ql-company" className="text-[13px]">Company</Label>
                {company?.timezone && <CompanyLocalTime timezone={company.timezone} compact />}
              </div>
              <EntityCombobox
                id="ql-company"
                options={companyOptions}
                value={s.companyId}
                onChange={(v) => set({ companyId: v, contactId: null, opportunityId: null, parentActivityId: null })}
                onCreate={(name) => set({ newCompanyName: name, companyId: null, contactId: null })}
                pendingCreate={s.newCompanyName}
                onClearCreate={() => set({ newCompanyName: null })}
                placeholder="Search or create…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ql-contact" className="text-[13px]">
                Contact <span className="font-normal text-muted-foreground">optional</span>
              </Label>
              <EntityCombobox
                id="ql-contact"
                options={contactOptions}
                value={s.contactId}
                onChange={(v) => set({ contactId: v, parentActivityId: null })}
                onCreate={(name) => set({ newContactName: name, contactId: null })}
                pendingCreate={s.newContactName}
                onClearCreate={() => set({ newContactName: null })}
                placeholder="Who?"
              />
            </div>
          </div>

          {recent && (
            <p className="flex items-start gap-2 rounded-md bg-status-withdrawn/10 px-2.5 py-2 text-xs text-foreground/85">
              <TriangleAlert className="mt-px size-3.5 shrink-0 text-status-withdrawn" />
              You already sent this contact a {ACTIVITY_META[recent.type].label.toLowerCase()}{" "}
              {relativeShort(recent.occurredAt, clock || recent.occurredAt, timezone).toLowerCase()}. Give it a few days?
            </p>
          )}

          {(s.type === "follow_up" || s.direction === "inbound") && (
            <div className="space-y-1.5">
              <Label htmlFor="ql-thread" className="text-[13px]">
                {s.direction === "inbound" ? "Reply to" : "Following up on"}
              </Label>
              <EntityCombobox
                id="ql-thread"
                options={threadOptions}
                value={parentId}
                onChange={(v) => set({ parentActivityId: v })}
                placeholder={threadOptions.length ? "Pick the original message" : "No recent threads"}
                emptyText="No recent threads for this company"
              />
            </div>
          )}

          {s.type === "application" ? (
            s.opportunityId ? (
              <p className="text-[13px] text-muted-foreground">
                Applying to{" "}
                <span className="font-medium text-foreground">
                  {lookups?.opportunities.find((o) => o.id === s.opportunityId)?.title ?? "this role"}
                </span>
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ql-role" className="text-[13px]">Role title</Label>
                  <Input
                    id="ql-role"
                    value={s.newOpportunityTitle}
                    onChange={(e) => set({ newOpportunityTitle: e.target.value })}
                    placeholder="Backend Engineering Intern"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ql-country" className="text-[13px]">
                    Country <span className="font-normal text-muted-foreground">optional</span>
                  </Label>
                  <Input
                    id="ql-country"
                    value={s.newOpportunityCountry}
                    onChange={(e) => set({ newOpportunityCountry: e.target.value })}
                    placeholder="Germany"
                    className="h-9"
                  />
                </div>
              </div>
            )
          ) : (
            s.type !== "follow_up" &&
            opportunityOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="ql-opp" className="text-[13px]">
                  Opportunity <span className="font-normal text-muted-foreground">optional</span>
                </Label>
                <EntityCombobox
                  id="ql-opp"
                  options={opportunityOptions}
                  value={s.opportunityId}
                  onChange={(v) => set({ opportunityId: v })}
                  placeholder="Link to a role"
                />
              </div>
            )
          )}

          {isEmailish && (
            <div className="space-y-1.5">
              <Label htmlFor="ql-subject" className="text-[13px]">
                Subject <span className="font-normal text-muted-foreground">optional</span>
              </Label>
              <Input id="ql-subject" value={s.subject} onChange={(e) => set({ subject: e.target.value })} className="h-9" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ql-summary" className="text-[13px]">
              Notes <span className="font-normal text-muted-foreground">optional</span>
            </Label>
            <Textarea
              id="ql-summary"
              value={s.summary}
              onChange={(e) => set({ summary: e.target.value })}
              rows={2}
              placeholder="What did you send or talk about?"
              className="min-h-16"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="ql-when" className="text-[13px]">When</Label>
              <DateTimeInput id="ql-when" value={s.occurredAt ?? new Date()} onChange={(d) => set({ occurredAt: d })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ql-template" className="text-[13px]">
                Template <span className="font-normal text-muted-foreground">optional</span>
              </Label>
              <SelectField
                id="ql-template"
                value={s.templateId ? String(s.templateId) : ""}
                onChange={(v) => set({ templateId: v ? Number(v) : null })}
                options={templateOptions}
                placeholder={templateOptions.length ? "None" : "No templates"}
                allowNone
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-[13px] font-medium">Direction</span>
              <div className="flex h-9 rounded-lg border p-0.5">
                {(["outbound", "inbound"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={s.direction === d}
                    onClick={() => set({ direction: d })}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2.5 text-xs font-medium",
                      s.direction === d ? "bg-muted text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {d === "outbound" ? <ArrowUpRight className="size-3.5" /> : <ArrowDownLeft className="size-3.5" />}
                    {d === "outbound" ? "Sent" : "Received"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {s.direction === "outbound" && OUTREACH_TYPES.includes(s.type) && (
            <p className="text-xs text-muted-foreground">
              A follow-up reminder is set automatically from your rules in Settings.
              {s.occurredAt && ` Logged for ${formatTz(s.occurredAt, timezone, "EEE d MMM, HH:mm")}.`}
            </p>
          )}

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-4 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground select-none">
            <Checkbox checked={another} onCheckedChange={(v) => setAnother(v === true)} />
            Log another
          </label>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              <Kbd>Ctrl</Kbd> <Kbd>↵</Kbd>
            </span>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <LoaderCircle className="animate-spin" />}
              Log {ACTIVITY_META[s.type].short.toLowerCase()}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const focusCompany = () => document.getElementById("ql-company")?.focus();
