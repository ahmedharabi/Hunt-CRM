"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FormField, applyServerErrors } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { EntityCombobox, MultiEntityCombobox } from "@/components/shared/entity-combobox";
import { TagInput } from "@/components/shared/tag-input";
import { DateTimeInput } from "@/components/shared/datetime-input";
import { CompanyAvatar } from "@/components/shared/company-avatar";
import { useLookups } from "@/components/providers/lookups";
import { checkRoleDuplicates, saveCompany, saveOpportunity } from "@/lib/actions/records";
import { opportunitySchema, type OpportunityInput, type OpportunityValues } from "@/lib/validators";
import { EMPLOYMENT_META, REMOTE_META, SOURCE_META, STATUS_META, options } from "@/lib/meta";
import { DuplicateWarning, FormSheet, Row } from "./form-sheet";

const empty: OpportunityInput = {
  companyId: undefined as unknown as number,
  title: "",
  employmentType: "internship",
  workMode: "",
  location: "",
  jobUrl: "",
  source: "",
  status: "wishlist",
  compensation: "",
  deadline: null,
  resumeVersionId: null,
  coverLetterUsed: false,
  priority: 2,
  excitement: 3,
  notes: "",
  jobDescription: "",
  rejectionReason: "",
  referredByContactId: null,
  contactIds: [],
  tags: [],
};

export function OpportunityForm({
  open,
  onOpenChange,
  id,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  id?: number;
  initial?: Partial<OpportunityInput>;
  onSaved?: (o: { id: number; title: string }) => void;
}) {
  const router = useRouter();
  const { data: lookups, refresh } = useLookups();
  const form = useForm<OpportunityInput, unknown, OpportunityValues>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: { ...empty, ...initial },
  });
  const { control, handleSubmit, reset, setError, setValue, formState } = form;
  useEffect(() => {
    if (open) reset({ ...empty, ...initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const [companyId, title, status] = useWatch({ control, name: ["companyId", "title", "status"] });

  const companyOptions = useMemo(
    () =>
      (lookups?.companies ?? []).map((c) => ({
        value: c.id,
        label: c.name,
        icon: <CompanyAvatar name={c.name} logoUrl={c.logoUrl} className="size-5 rounded text-[8px]" />,
      })),
    [lookups],
  );
  const contactOptions = useMemo(
    () =>
      (lookups?.contacts ?? [])
        .filter((c) => !companyId || c.companyId === Number(companyId))
        .map((c) => ({ value: c.id, label: c.name, hint: c.role })),
    [lookups, companyId],
  );

  const [dupes, setDupes] = useState<{ id: number; title: string }[]>([]);
  useEffect(() => {
    if (!open || !companyId || !title || title.trim().length < 3) return;
    const t = setTimeout(async () => {
      const r = await checkRoleDuplicates(Number(companyId), title, id);
      setDupes(r.ok ? r.data : []);
    }, 300);
    return () => clearTimeout(t);
  }, [companyId, title, id, open]);
  const visibleDupes = companyId && title && title.trim().length >= 3 ? dupes : [];

  const createCompany = async (name: string) => {
    const r = await saveCompany({ name, tier: "target", techStack: [], tags: [] });
    if (!r.ok) return toast.error(r.error);
    await refresh();
    setValue("companyId", r.data.id, { shouldValidate: true });
    toast.success(`Added ${r.data.name}`);
  };

  const onSubmit = handleSubmit(async (values) => {
    const r = await saveOpportunity(values, id);
    if (!r.ok) {
      applyServerErrors(setError, r.fieldErrors);
      toast.error(r.error);
      return;
    }
    toast.success(id ? "Opportunity updated" : `Tracking ${r.data.title}`);
    void refresh();
    onOpenChange(false);
    if (onSaved) onSaved(r.data);
    else if (!id) router.push(`/opportunities/${r.data.id}`);
  });

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={id ? "Edit opportunity" : "New opportunity"}
      formId="opportunity-form"
      onSubmit={onSubmit}
      submitting={formState.isSubmitting}
      submitLabel={id ? "Save changes" : "Add opportunity"}
      wide
    >
      <Row>
        <FormField control={control} name="companyId" label="Company">
          {({ field, id: fid, invalid }) => (
            <EntityCombobox
              id={fid}
              options={companyOptions}
              value={field.value as number | null}
              onChange={(v) => field.onChange(v ?? undefined)}
              onCreate={createCompany}
              placeholder="Pick or create…"
              invalid={invalid}
            />
          )}
        </FormField>
        <FormField control={control} name="title" label="Role">
          {({ field, id: fid, invalid }) => (
            <Input id={fid} {...field} value={field.value ?? ""} aria-invalid={invalid} placeholder="Platform Engineering Intern" className="h-9" />
          )}
        </FormField>
      </Row>
      {visibleDupes.length > 0 && (
        <DuplicateWarning>
          Already tracking{" "}
          {visibleDupes.map((d, i) => (
            <span key={d.id}>
              {i > 0 && ", "}
              <Link href={`/opportunities/${d.id}`} className="font-medium underline underline-offset-2">
                {d.title}
              </Link>
            </span>
          ))}{" "}
          at this company.
        </DuplicateWarning>
      )}
      <Row>
        <FormField control={control} name="status" label="Status">
          {({ field, id: fid }) => <SelectField id={fid} value={field.value} onChange={field.onChange} options={options(STATUS_META)} />}
        </FormField>
        <FormField control={control} name="employmentType" label="Type">
          {({ field, id: fid }) => <SelectField id={fid} value={field.value} onChange={field.onChange} options={options(EMPLOYMENT_META)} />}
        </FormField>
      </Row>
      {status === "rejected" && (
        <FormField control={control} name="rejectionReason" label="Rejection reason" optional>
          {({ field, id: fid }) => <Input id={fid} {...field} value={field.value ?? ""} placeholder="Position filled internally" className="h-9" />}
        </FormField>
      )}
      <Row>
        <FormField control={control} name="source" label="Source" optional>
          {({ field, id: fid }) => <SelectField id={fid} value={field.value} onChange={field.onChange} options={options(SOURCE_META)} allowNone />}
        </FormField>
        <FormField control={control} name="workMode" label="Work mode" optional>
          {({ field, id: fid }) => <SelectField id={fid} value={field.value} onChange={field.onChange} options={options(REMOTE_META)} allowNone />}
        </FormField>
      </Row>
      <Row>
        <FormField control={control} name="location" label="Location" optional>
          {({ field, id: fid }) => <Input id={fid} {...field} value={field.value ?? ""} placeholder="Remote (EMEA)" className="h-9" />}
        </FormField>
        <FormField control={control} name="compensation" label="Stipend / salary" optional>
          {({ field, id: fid }) => <Input id={fid} {...field} value={field.value ?? ""} placeholder="€1,200/mo" className="h-9" />}
        </FormField>
      </Row>
      <FormField control={control} name="jobUrl" label="Job posting" optional>
        {({ field, id: fid, invalid }) => (
          <Input id={fid} {...field} value={field.value ?? ""} aria-invalid={invalid} placeholder="https://…" className="h-9" inputMode="url" />
        )}
      </FormField>
      <Row>
        <FormField control={control} name="deadline" label="Deadline" optional>
          {({ field, id: fid, invalid }) => (
            <DateTimeInput id={fid} dateOnly value={field.value as Date | null} onChange={field.onChange} aria-invalid={invalid} className="h-9" />
          )}
        </FormField>
        <FormField control={control} name="resumeVersionId" label="Resume version" optional>
          {({ field, id: fid }) => (
            <SelectField
              id={fid}
              value={field.value ? String(field.value) : ""}
              onChange={(v) => field.onChange(v ? Number(v) : null)}
              options={(lookups?.resumes ?? []).map((r) => ({ value: String(r.id), label: r.name }))}
              allowNone
            />
          )}
        </FormField>
      </Row>
      <Row>
        <FormField control={control} name="priority" label="Priority">
          {({ field }) => (
            <ToggleGroup
              type="single"
              variant="outline"
              value={String(field.value)}
              onValueChange={(v) => v && field.onChange(Number(v))}
              className="w-full"
            >
              {[
                ["1", "High"],
                ["2", "Medium"],
                ["3", "Low"],
              ].map(([v, l]) => (
                <ToggleGroupItem key={v} value={v} className="h-9 flex-1 text-xs">
                  {l}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </FormField>
        <FormField control={control} name="excitement" label="Excitement">
          {({ field }) => (
            <ToggleGroup
              type="single"
              variant="outline"
              value={String(field.value)}
              onValueChange={(v) => v && field.onChange(Number(v))}
              className="w-full"
            >
              {["1", "2", "3", "4", "5"].map((v) => (
                <ToggleGroupItem key={v} value={v} className="tabular h-9 flex-1 text-xs" aria-label={`Excitement ${v}`}>
                  {v}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </FormField>
      </Row>
      <FormField control={control} name="coverLetterUsed">
        {({ field, id: fid }) => (
          <label htmlFor={fid} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
            Sent a cover letter
            <Switch id={fid} checked={!!field.value} onCheckedChange={field.onChange} />
          </label>
        )}
      </FormField>
      <Row>
        <FormField control={control} name="contactIds" label="People involved" optional>
          {({ field, id: fid }) => (
            <MultiEntityCombobox id={fid} options={contactOptions} value={(field.value ?? []) as number[]} onChange={field.onChange} placeholder="Recruiter, engineer…" />
          )}
        </FormField>
        <FormField control={control} name="referredByContactId" label="Referred by" optional>
          {({ field, id: fid }) => (
            <EntityCombobox
              id={fid}
              options={contactOptions}
              value={field.value as number | null}
              onChange={field.onChange}
              placeholder="No referral"
            />
          )}
        </FormField>
      </Row>
      <FormField control={control} name="tags" label="Tags" optional>
        {({ field, id: fid }) => <TagInput id={fid} value={field.value ?? []} onChange={field.onChange} suggestions={lookups?.tags} />}
      </FormField>
      <FormField control={control} name="jobDescription" label="Job description" optional description="Paste the posting — it's searchable and survives the listing being taken down.">
        {({ field, id: fid }) => <Textarea id={fid} {...field} value={field.value ?? ""} rows={6} className="font-mono text-[13px]" />}
      </FormField>
      <FormField control={control} name="notes" label="Notes" optional>
        {({ field, id: fid }) => <Textarea id={fid} {...field} value={field.value ?? ""} rows={4} className="font-mono text-[13px]" />}
      </FormField>
    </FormSheet>
  );
}
