"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FormField, applyServerErrors } from "@/components/shared/form-field";
import { SelectField } from "@/components/shared/select-field";
import { MultiEntityCombobox } from "@/components/shared/entity-combobox";
import { DateTimeInput } from "@/components/shared/datetime-input";
import { useLookups } from "@/components/providers/lookups";
import { saveInterview } from "@/lib/actions/activities";
import { interviewSchema, type InterviewInput, type InterviewValues } from "@/lib/validators";
import { INTERVIEW_OUTCOME_META, INTERVIEW_STAGE_META, STATUS_META, options } from "@/lib/meta";
import { FormSheet, Row } from "./form-sheet";

export function InterviewForm({
  open,
  onOpenChange,
  opportunityId,
  companyId,
  id,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  opportunityId: number;
  companyId: number;
  id?: number;
  initial?: Partial<InterviewInput>;
}) {
  const router = useRouter();
  const { data: lookups } = useLookups();
  const defaults: InterviewInput = {
    opportunityId,
    stage: "hr_screen",
    scheduledAt: null,
    durationMinutes: 45,
    prepNotes: "",
    questionsAsked: "",
    selfRating: null,
    outcome: "scheduled",
    feedback: "",
    interviewerIds: [],
    ...initial,
  };
  const { control, handleSubmit, reset, setError, formState } = useForm<InterviewInput, unknown, InterviewValues>({
    resolver: zodResolver(interviewSchema),
    defaultValues: defaults,
  });
  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const people = useMemo(
    () => (lookups?.contacts ?? []).filter((c) => c.companyId === companyId).map((c) => ({ value: c.id, label: c.name, hint: c.role })),
    [lookups, companyId],
  );

  const onSubmit = handleSubmit(async (values) => {
    const r = await saveInterview(values, id);
    if (!r.ok) {
      applyServerErrors(setError, r.fieldErrors);
      toast.error(r.error);
      return;
    }
    toast.success(
      id ? "Interview updated" : "Interview scheduled",
      r.data.statusChange ? { description: `Moved to ${STATUS_META[r.data.statusChange.to].label}` } : undefined,
    );
    onOpenChange(false);
    router.refresh();
  });

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={id ? "Edit interview" : "Schedule interview"}
      description="Scheduling one moves the opportunity to Interviewing."
      formId="interview-form"
      onSubmit={onSubmit}
      submitting={formState.isSubmitting}
    >
      <Row>
        <FormField control={control} name="stage" label="Stage">
          {({ field, id: fid }) => <SelectField id={fid} value={field.value} onChange={field.onChange} options={options(INTERVIEW_STAGE_META)} />}
        </FormField>
        <FormField control={control} name="outcome" label="Outcome">
          {({ field, id: fid }) => <SelectField id={fid} value={field.value} onChange={field.onChange} options={options(INTERVIEW_OUTCOME_META)} />}
        </FormField>
      </Row>
      <Row>
        <FormField control={control} name="scheduledAt" label="When">
          {({ field, id: fid, invalid }) => (
            <DateTimeInput id={fid} value={field.value as Date | null} onChange={field.onChange} aria-invalid={invalid} className="h-9" />
          )}
        </FormField>
        <FormField control={control} name="durationMinutes" label="Duration (minutes)">
          {({ field, id: fid }) => <Input id={fid} type="number" min={5} step={5} {...field} value={String(field.value ?? "")} className="h-9" />}
        </FormField>
      </Row>
      <FormField control={control} name="interviewerIds" label="Interviewers" optional>
        {({ field, id: fid }) => (
          <MultiEntityCombobox id={fid} options={people} value={(field.value ?? []) as number[]} onChange={field.onChange} placeholder="People at this company" />
        )}
      </FormField>
      <FormField control={control} name="prepNotes" label="Prep notes" optional>
        {({ field, id: fid }) => <Textarea id={fid} {...field} value={field.value ?? ""} rows={4} placeholder="Stories to tell, things to research, questions to ask…" />}
      </FormField>
      <FormField control={control} name="questionsAsked" label="Questions they asked" optional>
        {({ field, id: fid }) => <Textarea id={fid} {...field} value={field.value ?? ""} rows={3} />}
      </FormField>
      <FormField control={control} name="selfRating" label="How did it go?" optional>
        {({ field }) => (
          <ToggleGroup
            type="single"
            variant="outline"
            value={field.value ? String(field.value) : ""}
            onValueChange={(v) => field.onChange(v ? Number(v) : null)}
            className="w-full"
          >
            {["1", "2", "3", "4", "5"].map((v) => (
              <ToggleGroupItem key={v} value={v} className="tabular h-9 flex-1" aria-label={`${v} out of 5`}>
                {v}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </FormField>
      <FormField control={control} name="feedback" label="Feedback received" optional>
        {({ field, id: fid }) => <Textarea id={fid} {...field} value={field.value ?? ""} rows={3} />}
      </FormField>
    </FormSheet>
  );
}
