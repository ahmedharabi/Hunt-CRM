"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EntityCombobox } from "@/components/shared/entity-combobox";
import { SelectField } from "@/components/shared/select-field";
import { CompanyLocalTime } from "@/components/shared/local-time";
import { useLookups } from "@/components/providers/lookups";
import { logActivity } from "@/lib/actions/activities";
import { TEMPLATE_TYPE_META } from "@/lib/meta";
import { fillTemplate, varsFor } from "@/lib/templates";
import type { TemplateType } from "@/lib/domain";

/**
 * Pick a template and a contact, preview with variables filled in, copy to
 * the clipboard, and (optionally) log it as sent with the template attached.
 */
export function UseTemplateDialog({
  open,
  onOpenChange,
  templateId: initialTemplate,
  contactId: initialContact,
  opportunityId: initialOpp,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templateId?: number | null;
  contactId?: number | null;
  opportunityId?: number | null;
}) {
  const router = useRouter();
  const { data: lookups, refresh } = useLookups();
  const [templateId, setTemplateId] = useState<number | null>(initialTemplate ?? null);
  const [contactId, setContactId] = useState<number | null>(initialContact ?? null);
  const [opportunityId, setOpportunityId] = useState<number | null>(initialOpp ?? null);
  const [logIt, setLogIt] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset each time it opens (adjusting state during render instead of in an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setTemplateId(initialTemplate ?? null);
      setContactId(initialContact ?? null);
      setOpportunityId(initialOpp ?? null);
      setCopied(false);
    }
  }

  // Default to the first template once lookups arrive.
  const template = lookups?.templates.find((t) => t.id === templateId) ?? (templateId === null ? lookups?.templates[0] : undefined);
  const contact = lookups?.contacts.find((c) => c.id === contactId);
  const company = lookups?.companies.find((c) => c.id === contact?.companyId);
  const opps = (lookups?.opportunities ?? []).filter((o) => !contact?.companyId || o.companyId === contact.companyId);
  const opp = opps.find((o) => o.id === opportunityId) ?? null;

  const vars = varsFor({ contactName: contact?.name, contactRole: contact?.role, company: company?.name, role: opp?.title });
  const filled = {
    subject: template?.subject ? fillTemplate(template.subject, vars) : null,
    body: template ? fillTemplate(template.body, vars) : { text: "", missing: [] as string[] },
  };
  const missing = [...new Set([...(filled.subject?.missing ?? []), ...filled.body.missing])];

  const copyAndLog = async () => {
    const text = filled.subject ? `Subject: ${filled.subject.text}\n\n${filled.body.text}` : filled.body.text;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      toast.error("Couldn't access the clipboard — select the preview and copy it manually.");
      return;
    }
    if (!logIt || !template) {
      toast.success("Copied to clipboard");
      return;
    }
    setBusy(true);
    const r = await logActivity({
      type: TEMPLATE_TYPE_META[template.type as TemplateType].activity,
      companyId: contact?.companyId ?? null,
      contactId,
      opportunityId,
      templateId: template.id,
      subject: filled.subject?.text ?? null,
      summary: filled.body.text,
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Copied and logged as sent");
    void refresh();
    router.refresh();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Write a message</DialogTitle>
          <DialogDescription>Variables fill in from the contact, their company and the role.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="ut-template" className="text-[13px]">Template</Label>
            <SelectField
              id="ut-template"
              value={template ? String(template.id) : ""}
              onChange={(v) => setTemplateId(v ? Number(v) : null)}
              options={(lookups?.templates ?? []).map((t) => ({ value: String(t.id), label: t.name }))}
              placeholder="Choose…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ut-contact" className="text-[13px]">To</Label>
            <EntityCombobox
              id="ut-contact"
              options={(lookups?.contacts ?? []).map((c) => ({ value: c.id, label: c.name, hint: lookups?.companies.find((x) => x.id === c.companyId)?.name }))}
              value={contactId}
              onChange={(v) => {
                setContactId(v);
                setOpportunityId(null);
              }}
              placeholder="Pick a contact"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ut-role" className="text-[13px]">Role</Label>
            <SelectField
              id="ut-role"
              value={opportunityId ? String(opportunityId) : ""}
              onChange={(v) => setOpportunityId(v ? Number(v) : null)}
              options={opps.map((o) => ({ value: String(o.id), label: o.title }))}
              placeholder={opps.length ? "Optional" : "No roles"}
              allowNone
            />
          </div>
        </div>
        <div className="px-5 pb-4">
          <div className="rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
              <span>Preview</span>
              {company?.timezone && <CompanyLocalTime timezone={company.timezone} />}
            </div>
            <div className="max-h-72 overflow-y-auto px-3 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap select-text">
              {template ? (
                <>
                  {filled.subject && (
                    <p className="mb-3 font-medium">
                      <Highlighted text={filled.subject.text} />
                    </p>
                  )}
                  <Highlighted text={filled.body.text} />
                </>
              ) : (
                <span className="text-muted-foreground">Create a template first on the Templates page.</span>
              )}
            </div>
          </div>
          {missing.length > 0 && (
            <p className="mt-2 text-xs text-status-withdrawn">
              Still blank: {missing.map((m) => `{{${m}}}`).join(", ")} — pick a {missing.includes("role") ? "role" : "contact"} or edit after pasting.
            </p>
          )}
        </div>
        <DialogFooter className="m-0 items-center rounded-none border-t px-5 py-3">
          <label className="mr-auto flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground select-none">
            <Checkbox checked={logIt} onCheckedChange={(v) => setLogIt(v === true)} disabled={!contact} />
            Log as sent
          </label>
          <Button onClick={copyAndLog} disabled={!template || busy}>
            {busy ? <LoaderCircle className="animate-spin" /> : copied ? <Check /> : <Copy />}
            {logIt && contact ? "Copy & log" : "Copy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Highlighted({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{\{[^}]+\}\})/).map((part, i) =>
        part.startsWith("{{") ? (
          <mark key={i} className="rounded bg-status-withdrawn/15 px-0.5 font-mono text-[12px] text-status-withdrawn">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
