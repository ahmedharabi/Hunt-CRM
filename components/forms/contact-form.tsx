"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, applyServerErrors } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { EntityCombobox } from "@/components/shared/entity-combobox";
import { CompanyAvatar } from "@/components/shared/company-avatar";
import { useLookups } from "@/components/providers/lookups";
import { saveContact } from "@/lib/actions/records";
import { contactSchema, type ContactInput, type ContactValues } from "@/lib/validators";
import { CONTACT_TYPE_META, options } from "@/lib/meta";
import { FormSheet, Row } from "./form-sheet";

const empty: ContactInput = { companyId: null, name: "", role: "", contactType: "", linkedinUrl: "", email: "", notes: "" };

export function ContactForm({
  open,
  onOpenChange,
  id,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  id?: number;
  initial?: Partial<ContactInput>;
  onSaved?: (c: { id: number; name: string }) => void;
}) {
  const router = useRouter();
  const { data: lookups, refresh } = useLookups();
  const form = useForm<ContactInput, unknown, ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { ...empty, ...initial },
  });
  const { control, handleSubmit, reset, setError, formState } = form;
  useEffect(() => {
    if (open) reset({ ...empty, ...initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const companyOptions = useMemo(
    () =>
      (lookups?.companies ?? []).map((c) => ({
        value: c.id,
        label: c.name,
        icon: <CompanyAvatar name={c.name} logoUrl={c.logoUrl} className="size-5 rounded text-[8px]" />,
      })),
    [lookups],
  );

  const onSubmit = handleSubmit(async (values) => {
    const r = await saveContact(values, id);
    if (!r.ok) {
      applyServerErrors(setError, r.fieldErrors);
      toast.error(r.error);
      return;
    }
    toast.success(id ? "Contact updated" : `Added ${r.data.name}`);
    void refresh();
    onOpenChange(false);
    if (onSaved) onSaved(r.data);
    else if (!id) router.push(`/contacts/${r.data.id}`);
  });

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={id ? "Edit contact" : "Add contact"}
      formId="contact-form"
      onSubmit={onSubmit}
      submitting={formState.isSubmitting}
      submitLabel={id ? "Save changes" : "Add contact"}
    >
      <FormField control={control} name="name" label="Name">
        {({ field, id: fid, invalid }) => (
          <Input id={fid} {...field} value={field.value ?? ""} aria-invalid={invalid} autoFocus placeholder="Sarah Schmidt" className="h-9" />
        )}
      </FormField>
      <FormField control={control} name="companyId" label="Company" optional>
        {({ field, id: fid }) => (
          <EntityCombobox
            id={fid}
            options={companyOptions}
            value={field.value as number | null}
            onChange={field.onChange}
            placeholder="Pick a company"
          />
        )}
      </FormField>
      <Row>
        <FormField control={control} name="role" label="Role" optional>
          {({ field, id: fid }) => <Input id={fid} {...field} value={field.value ?? ""} placeholder="Staff SRE" className="h-9" />}
        </FormField>
        <FormField control={control} name="contactType" label="Type" optional>
          {({ field, id: fid }) => <SelectField id={fid} value={field.value} onChange={field.onChange} options={options(CONTACT_TYPE_META)} allowNone />}
        </FormField>
      </Row>
      <FormField control={control} name="email" label="Email" optional>
        {({ field, id: fid, invalid }) => (
          <Input id={fid} type="email" {...field} value={field.value ?? ""} aria-invalid={invalid} className="h-9" inputMode="email" />
        )}
      </FormField>
      <FormField control={control} name="linkedinUrl" label="LinkedIn" optional>
        {({ field, id: fid, invalid }) => (
          <Input id={fid} {...field} value={field.value ?? ""} aria-invalid={invalid} placeholder="linkedin.com/in/…" className="h-9" inputMode="url" />
        )}
      </FormField>
      <FormField control={control} name="notes" label="Notes" optional description="Markdown supported.">
        {({ field, id: fid }) => <Textarea id={fid} {...field} value={field.value ?? ""} rows={5} className="font-mono text-[13px]" />}
      </FormField>
    </FormSheet>
  );
}
