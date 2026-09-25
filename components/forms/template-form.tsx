"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, applyServerErrors } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { useLookups } from "@/components/providers/lookups";
import { saveTemplate } from "@/lib/actions/misc";
import { templateSchema, type TemplateInput, type TemplateValues } from "@/lib/validators";
import { TEMPLATE_TYPE_META, options } from "@/lib/meta";
import { TEMPLATE_VARIABLES, fillTemplate, variablesIn } from "@/lib/templates";
import { FormSheet } from "./form-sheet";

const SAMPLE = { first_name: "Sarah", last_name: "Schmidt", full_name: "Sarah Schmidt", company: "Grafana Labs", role: "Platform Engineering Intern", contact_role: "Staff SRE" };

export function TemplateForm({ open, onOpenChange, id, initial }: { open: boolean; onOpenChange: (o: boolean) => void; id?: number; initial?: Partial<TemplateInput> }) {
  const router = useRouter();
  const { refresh } = useLookups();
  const defaults: TemplateInput = { name: "", type: "cold_email", subject: "", body: "", ...initial };
  const { control, handleSubmit, reset, setError, setValue, getValues, formState } = useForm<TemplateInput, unknown, TemplateValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: defaults,
  });
  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const [type, subject, body] = useWatch({ control, name: ["type", "subject", "body"] });
  const known = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.key));
  const unknown = variablesIn(`${subject ?? ""} ${body ?? ""}`).filter((v) => !known.has(v));

  const insert = (key: string) => {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    const current = getValues("body") ?? "";
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    setValue("body", current.slice(0, start) + token + current.slice(end), { shouldDirty: true });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    const r = await saveTemplate(values, id);
    if (!r.ok) {
      applyServerErrors(setError, r.fieldErrors);
      toast.error(r.error);
      return;
    }
    toast.success(id ? "Template saved" : "Template created");
    void refresh();
    onOpenChange(false);
    router.refresh();
  });

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={id ? "Edit template" : "New template"} formId="template-form" onSubmit={onSubmit} submitting={formState.isSubmitting} wide>
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <FormField control={control} name="name" label="Name">
          {({ field, id: fid, invalid }) => <Input id={fid} {...field} value={field.value ?? ""} aria-invalid={invalid} autoFocus placeholder="Cold email — platform team" className="h-9" />}
        </FormField>
        <FormField control={control} name="type" label="Type">
          {({ field, id: fid }) => <SelectField id={fid} value={field.value} onChange={field.onChange} options={options(TEMPLATE_TYPE_META)} />}
        </FormField>
      </div>
      {(type === "cold_email" || type === "follow_up") && (
        <FormField control={control} name="subject" label="Subject" optional>
          {({ field, id: fid }) => <Input id={fid} {...field} value={field.value ?? ""} placeholder="Platform internship at {{company}}?" className="h-9" />}
        </FormField>
      )}
      <FormField control={control} name="body" label="Message">
        {({ field, id: fid, invalid }) => (
          <>
            <div className="flex flex-wrap gap-1">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  title={v.hint}
                  onClick={() => insert(v.key)}
                  className="rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
            <Textarea
              id={fid}
              {...field}
              ref={(el) => {
                field.ref(el);
                bodyRef.current = el;
              }}
              value={field.value ?? ""}
              aria-invalid={invalid}
              rows={9}
              className="text-[13.5px] leading-relaxed"
              placeholder={"Hi {{first_name}},\n\n…"}
            />
            {type === "connection_note" && (
              <p className={`text-xs ${(fillTemplate(body ?? "", SAMPLE).text.length > 300) ? "text-destructive" : "text-muted-foreground"}`}>
                {fillTemplate(body ?? "", SAMPLE).text.length}/300 characters (LinkedIn&apos;s limit for connection notes)
              </p>
            )}
          </>
        )}
      </FormField>
      {unknown.length > 0 && (
        <p className="text-xs text-status-withdrawn">Unknown variable{unknown.length > 1 ? "s" : ""}: {unknown.map((u) => `{{${u}}}`).join(", ")} — they&apos;ll stay as-is.</p>
      )}
      <div className="rounded-lg border bg-muted/30">
        <p className="border-b px-3 py-2 text-xs text-muted-foreground">Preview with sample values</p>
        <div className="px-3 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap">
          {subject && <p className="mb-2 font-medium">{fillTemplate(subject, SAMPLE).text}</p>}
          {body ? fillTemplate(body, SAMPLE).text : <span className="text-muted-foreground">Start typing to see it filled in.</span>}
        </div>
      </div>
    </FormSheet>
  );
}
