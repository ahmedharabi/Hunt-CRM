"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboOption = { value: number; label: string; hint?: string | null; icon?: React.ReactNode };

/**
 * Searchable single-select. With `onCreate`, typing a name that doesn't
 * exist offers "Create …" — the parent decides what creating means
 * (usually: remember the name and create it on submit).
 */
export function EntityCombobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  onCreate,
  pendingCreate,
  onClearCreate,
  id,
  invalid,
  className,
  disabled,
  autoFocus,
}: {
  options: ComboOption[];
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  onCreate?: (name: string) => void;
  /** A not-yet-created name selected via onCreate. */
  pendingCreate?: string | null;
  onClearCreate?: () => void;
  id?: string;
  invalid?: boolean;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((o) => o.value === value);
  const exact = useMemo(
    () => options.some((o) => o.label.toLowerCase() === search.trim().toLowerCase()),
    [options, search],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn("h-9 w-full justify-between px-2.5 font-normal", className)}
        >
          <span className={cn("flex min-w-0 items-center gap-2 truncate", !selected && !pendingCreate && "text-muted-foreground")}>
            {selected?.icon}
            {selected ? (
              <span className="truncate">{selected.label}</span>
            ) : pendingCreate ? (
              <span className="truncate">
                {pendingCreate} <span className="text-xs text-brand">· new</span>
              </span>
            ) : (
              placeholder
            )}
          </span>
          {selected || pendingCreate ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear"
              className="-mr-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(null);
                onClearCreate?.();
              }}
            >
              <X className="size-3.5" />
            </span>
          ) : (
            <ChevronsUpDown className="size-3.5 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{onCreate && search.trim() ? null : emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.hint ?? ""} #${o.value}`}
                  onSelect={() => {
                    onChange(o.value);
                    onClearCreate?.();
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  {o.icon}
                  <span className="truncate">{o.label}</span>
                  {o.hint && <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">{o.hint}</span>}
                  <Check className={cn("size-3.5 shrink-0", o.value === value ? "opacity-100" : "opacity-0", !o.hint && "ml-auto")} />
                </CommandItem>
              ))}
            </CommandGroup>
            {onCreate && search.trim() && !exact && (
              <CommandGroup forceMount>
                <CommandItem
                  forceMount
                  value={`__create__ ${search}`}
                  onSelect={() => {
                    onCreate(search.trim());
                    onChange(null);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Plus className="text-brand" />
                  Create <span className="font-medium">“{search.trim()}”</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Multi-select variant: chips in the trigger, checkmarks in the list. */
export function MultiEntityCombobox({
  options,
  value,
  onChange,
  placeholder,
  id,
}: {
  options: ComboOption[];
  value: number[];
  onChange: (value: number[]) => void;
  placeholder: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.filter((o) => value.includes(o.value));
  const toggle = (v: number) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" className="h-auto min-h-9 w-full justify-between px-2 py-1 font-normal">
          <span className="flex flex-wrap gap-1">
            {selected.length ? (
              selected.map((o) => (
                <span key={o.value} className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-xs">
                  {o.label}
                </span>
              ))
            ) : (
              <span className="px-0.5 text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No matches</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={`${o.label} ${o.hint ?? ""} #${o.value}`} onSelect={() => toggle(o.value)}>
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-[4px] border",
                      value.includes(o.value) && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {value.includes(o.value) && <Check className="size-3" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                  {o.hint && <span className="ml-auto truncate text-xs text-muted-foreground">{o.hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
