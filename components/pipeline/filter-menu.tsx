"use client";

import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function FilterMenu({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 border-dashed", value.length && "border-solid")}>
          {!value.length && <Plus data-icon="inline-start" />}
          {title}
          {value.length > 0 && <span className="rounded bg-muted px-1.5 text-[11px]">{value.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {options.map((o) => {
                const on = value.includes(o.value);
                return (
                  <CommandItem key={o.value} onSelect={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}>
                    <span className={cn("flex size-4 items-center justify-center rounded-[4px] border", on && "border-primary bg-primary text-primary-foreground")}>
                      {on && <Check className="size-3" />}
                    </span>
                    {o.label}
                  </CommandItem>
                );
              })}
              {value.length > 0 && (
                <CommandItem onSelect={() => onChange([])} className="justify-center text-muted-foreground">
                  Clear
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
