"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NONE = "__none__";

/** Select for enum fields; `allowNone` adds a "—" choice that maps to "". */
export function SelectField({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  allowNone,
  invalid,
  className,
}: {
  id?: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string; color?: string; icon?: React.ReactNode }[];
  placeholder?: string;
  allowNone?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <Select value={value ? value : allowNone ? NONE : undefined} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={id} aria-invalid={invalid} className={cn("h-9 w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectItem value={NONE}>
            <span className="text-muted-foreground">—</span>
          </SelectItem>
        )}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.color && <span className="size-2 rounded-full" style={{ backgroundColor: o.color }} />}
            {o.icon}
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
