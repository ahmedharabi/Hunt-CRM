"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COUNTRIES } from "@/lib/countries";
import { cn } from "@/lib/utils";

/**
 * Searchable country picker. A saved value that isn't in the list (typed
 * before the picker existed) still shows and stays selectable.
 */
export function CountryCombobox({
  value,
  onChange,
  id,
  invalid,
  placeholder = "Pick a country",
  className,
}: {
  value: string | null | undefined;
  onChange: (value: string) => void;
  id?: string;
  invalid?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = value?.trim() ?? "";
  const list: readonly string[] = current && !(COUNTRIES as readonly string[]).includes(current) ? [current, ...COUNTRIES] : COUNTRIES;

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
          className={cn("h-9 w-full justify-between px-2.5 font-normal", className)}
        >
          <span className={cn("truncate", !current && "text-muted-foreground")}>{current || placeholder}</span>
          {current ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear"
              className="-mr-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange("");
              }}
            >
              <X className="size-3.5" />
            </span>
          ) : (
            <ChevronsUpDown className="size-3.5 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search countries…" />
          <CommandList>
            <CommandEmpty>No matching country</CommandEmpty>
            <CommandGroup>
              {list.map((c) => (
                <CommandItem
                  key={c}
                  value={c}
                  onSelect={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{c}</span>
                  <Check className={cn("ml-auto size-3.5 shrink-0", c === current ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
