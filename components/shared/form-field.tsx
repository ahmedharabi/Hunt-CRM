"use client";

import { Controller, type Control, type ControllerRenderProps, type FieldPath, type FieldValues, type UseFormSetError } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** react-hook-form Controller + shadcn Field, with the label wired to the control. */
export function FormField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  className,
  optional,
  children,
}: {
  control: Control<T>;
  name: N;
  label?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  optional?: boolean;
  children: (props: { field: ControllerRenderProps<T, N>; id: string; invalid: boolean }) => React.ReactNode;
}) {
  const id = `f-${String(name).replace(/\./g, "-")}`;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={cn("gap-1.5", className)}>
          {label && (
            <FieldLabel htmlFor={id} className="text-[0.8125rem]">
              {label}
              {optional && <span className="font-normal text-muted-foreground">optional</span>}
            </FieldLabel>
          )}
          {children({ field, id, invalid: fieldState.invalid })}
          {description && !fieldState.error && <FieldDescription className="text-xs">{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} className="text-xs" />
        </Field>
      )}
    />
  );
}

/** Apply server-side field errors from an ActionResult to the form. */
export function applyServerErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors: Record<string, string> | undefined,
) {
  for (const [key, message] of Object.entries(fieldErrors ?? {})) {
    setError(key as FieldPath<T>, { message });
  }
}
