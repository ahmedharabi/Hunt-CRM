"use client";

import { useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveTextScale } from "@/lib/actions/misc";
import { TEXT_SCALE, clampTextScale } from "@/lib/appearance";

/** − 100% + stepper. Applies instantly and saves to settings.textScale. */
export function TextSizeStepper({ initial }: { initial: number }) {
  const [scale, setScale] = useState(() => clampTextScale(initial));
  // Rapid clicks step from the latest value, not the last render's.
  const latest = useRef(scale);

  const change = async (n: number) => {
    const next = clampTextScale(n);
    latest.current = next;
    setScale(next);
    // Inline style wins over the server-rendered <style> until the layout re-renders.
    document.documentElement.style.fontSize = `${next}%`;
    const r = await saveTextScale(next);
    if (!r.ok) toast.error(r.error);
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Decrease text size"
        disabled={scale <= TEXT_SCALE.min}
        onClick={() => change(latest.current - TEXT_SCALE.step)}
      >
        <Minus />
      </Button>
      <button
        type="button"
        title="Reset to default"
        onClick={() => change(TEXT_SCALE.default)}
        className="tabular w-14 rounded-md py-1 text-center text-xs font-medium hover:bg-muted"
        aria-live="polite"
      >
        {scale}%
      </button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Increase text size"
        disabled={scale >= TEXT_SCALE.max}
        onClick={() => change(latest.current + TEXT_SCALE.step)}
      >
        <Plus />
      </Button>
    </div>
  );
}
