"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { saveWeeklyNotes } from "@/lib/actions/misc";

/** Autosaves 800ms after you stop typing; also on blur. */
export function NotesEditor({ weekStart, initial }: { weekStart: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saved = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = async (text: string) => {
    if (text === saved.current) return;
    setState("saving");
    const r = await saveWeeklyNotes({ weekStart, notes: text });
    if (r.ok) {
      saved.current = text;
      setState("saved");
    } else setState("error");
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => {
          const text = e.target.value;
          setValue(text);
          setState("idle");
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => void save(text), 800);
        }}
        onBlur={() => void save(value)}
        rows={8}
        placeholder={"What worked this week? What didn't?\nWhat will you change next week?"}
        className="text-[13.5px] leading-relaxed"
        aria-label="Weekly reflection"
      />
      <p className="flex h-4 items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
        {state === "saving" && (
          <>
            <LoaderCircle className="size-3 animate-spin" /> Saving…
          </>
        )}
        {state === "saved" && (
          <>
            <Check className="size-3" /> Saved
          </>
        )}
        {state === "error" && <span className="text-destructive">Couldn&apos;t save — check the server is running.</span>}
      </p>
    </div>
  );
}
