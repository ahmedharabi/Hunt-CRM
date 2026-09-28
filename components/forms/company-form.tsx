"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, applyServerErrors } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { TagInput } from "@/components/shared/tag-input";
import { useLookups } from "@/components/providers/lookups";
import { checkCompanyDuplicates, saveCompany } from "@/lib/actions/records";
import { companySchema, type CompanyInput, type CompanyValues } from "@/lib/validators";
import { REMOTE_META, SIZE_OPTIONS, TIER_META, options } from "@/lib/meta";
import { DuplicateWarning, FormSheet, Row } from "./form-sheet";

const TIMEZONES = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];

const empty: CompanyInput = {
  name: "",
  website: "",
  linkedinUrl: "",
  logoUrl: "",
  industry: "",
  size: "",
  hqLocation: "",
  country: "",
  timezone: "",
  remotePolicy: "",
  techStack: [],
  tier: "target",
  notes: "",
  tags: [],
};

export function CompanyForm({
  open,
  onOpenChange,
  id,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  id?: number;
  initial?: Partial<CompanyInput>;
  onSaved?: (c: { id: number; name: string }) => void;
}) {
  const router = useRouter();
  const { data: lookups, refresh } = useLookups();
  const form = useForm<CompanyInput, unknown, CompanyValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { ...empty, ...initial },
  });
  const { control, handleSubmit, reset, setError, formState } = form;

  useEffect(() => {
    if (open) reset({ ...empty, ...initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const name = useWatch({ control, name: "name" });
  const [dupes, setDupes] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    if (!open || !name || name.trim().length < 2) return;
    const t = setTimeout(async () => {
      const r = await checkCompanyDuplicates(name, id);
      setDupes(r.ok ? r.data : []);
    }, 250);
    return () => clearTimeout(t);
  }, [name, id, open]);
  const visibleDupes = name && name.trim().length >= 2 ? dupes : [];

  const onSubmit = handleSubmit(async (values) => {
    const r = await saveCompany(values, id);
    if (!r.ok) {
      applyServerErrors(setError, r.fieldErrors);
      toast.error(r.error);
      return;
    }
    toast.success(id ? "Company updated" : `Added ${r.data.name}`);
    void refresh();
    onOpenChange(false);
    if (onSaved) onSaved(r.data);
    else if (!id) router.push(`/companies/${r.data.id}`);
  });

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={id ? "Edit company" : "Add company"}
      formId="company-form"
      onSubmit={onSubmit}
      submitting={formState.isSubmitting}
      submitLabel={id ? "Save changes" : "Add company"}
    >
      <FormField control={control} name="name" label="Name">
        {({ field, id: fid, invalid }) => (
          <Input id={fid} {...field} value={field.value ?? ""} aria-invalid={invalid} autoFocus placeholder="Grafana Labs" className="h-9" />
        )}
      </FormField>
      {visibleDupes.length > 0 && (
        <DuplicateWarning>
          Looks similar to{" "}
          {visibleDupes.map((d, i) => (
            <span key={d.id}>
              {i > 0 && ", "}
              <Link href={`/companies/${d.id}`} className="font-medium underline underline-offset-2">
                {d.name}
              </Link>
            </span>
          ))}
          . Save anyway if it&apos;s a different company.
        </DuplicateWarning>
      )}
      <Row>
        <FormField control={control} name="tier" label="Tier">
          {({ field, id: fid }) => <SelectField id={fid} value={field.value} onChange={field.onChange} options={options(TIER_META)} />}
        </FormField>
        <FormField control={control} name="industry" label="Industry" optional>
          {({ field, id: fid }) => <Input id={fid} {...field} value={field.value ?? ""} placeholder="Observability" className="h-9" />}
        </FormField>
      </Row>
      <Row>
        <FormField control={control} name="website" label="Website" optional>
          {({ field, id: fid, invalid }) => (
            <Input id={fid} {...field} value={field.value ?? ""} aria-invalid={invalid} placeholder="grafana.com" className="h-9" inputMode="url" />
          )}
        </FormField>
        <FormField control={control} name="linkedinUrl" label="LinkedIn" optional>
          {({ field, id: fid, invalid }) => (
            <Input id={fid} {...field} value={field.value ?? ""} aria-invalid={invalid} placeholder="linkedin.com/company/…" className="h-9" inputMode="url" />
          )}
        </FormField>
      </Row>
      <Row>
        <FormField control={control} name="size" label="Size" optional>
          {({ field, id: fid }) => <SelectField id={fid} value={field.value} onChange={field.onChange} options={SIZE_OPTIONS} allowNone />}
        </FormField>
        <FormField control={control} name="remotePolicy" label="Remote policy" optional>
          {({ field, id: fid }) => <SelectField id={fid} value={field.value} onChange={field.onChange} options={options(REMOTE_META)} allowNone />}
        </FormField>
      </Row>
      <Row>
        <FormField control={control} name="hqLocation" label="HQ" optional>
          {({ field, id: fid }) => <Input id={fid} {...field} value={field.value ?? ""} placeholder="Paris" className="h-9" />}
        </FormField>
        <FormField control={control} name="country" label="Country" optional>
          {({ field, id: fid }) => <Input id={fid} {...field} value={field.value ?? ""} placeholder="France" className="h-9" />}
        </FormField>
      </Row>
      <FormField control={control} name="timezone" label="Timezone" optional description="Used to show their local time before you message.">
        {({ field, id: fid, invalid }) => (
          <>
            <Input id={fid} list="tz-list" {...field} value={field.value ?? ""} aria-invalid={invalid} placeholder="Europe/Paris" className="h-9" />
            <datalist id="tz-list">
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </>
        )}
      </FormField>
      <FormField control={control} name="techStack" label="Tech stack" optional>
        {({ field, id: fid }) => <TagInput id={fid} value={field.value ?? []} onChange={field.onChange} placeholder="Go, Kubernetes…" />}
      </FormField>
      <FormField control={control} name="tags" label="Tags" optional>
        {({ field, id: fid }) => (
          <TagInput id={fid} value={field.value ?? []} onChange={field.onChange} suggestions={lookups?.tags} placeholder="remote-first, europe…" />
        )}
      </FormField>
      <FormField control={control} name="logoUrl" label="Logo URL" optional description="Leave empty to use initials.">
        {({ field, id: fid, invalid }) => (
          <Input id={fid} {...field} value={field.value ?? ""} aria-invalid={invalid} placeholder="https://…/logo.png" className="h-9" />
        )}
      </FormField>
      <FormField control={control} name="notes" label="Notes" optional description="Markdown supported.">
        {({ field, id: fid }) => <Textarea id={fid} {...field} value={field.value ?? ""} rows={5} className="font-mono text-[0.8125rem]" />}
      </FormField>
    </FormSheet>
  );
}
