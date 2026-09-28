"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeBackground, saveBackgroundStyle, uploadBackground } from "@/lib/actions/misc";
import { BACKGROUND, BACKGROUND_ROUTE, backgroundVars, type BackgroundStyle } from "@/lib/appearance";

type Key = keyof typeof BACKGROUND;

/**
 * Background image plus blur / dim / card-opacity sliders. Dragging updates
 * the CSS variables on <html> for a live preview; letting go saves.
 */
export function BackgroundSettings({ image, initial }: { image: string | null; initial: BackgroundStyle }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, start] = useTransition();
  const [style, setStyle] = useState(initial);
  const latest = useRef(initial);

  const preview = (key: Key, value: number) => {
    const next = { ...latest.current, [key]: value };
    latest.current = next;
    setStyle(next);
    for (const [k, v] of Object.entries(backgroundVars(next))) document.documentElement.style.setProperty(k, v);
  };
  const save = async () => {
    const r = await saveBackgroundStyle(latest.current);
    if (!r.ok) toast.error(r.error);
  };

  const upload = (file: File) =>
    start(async () => {
      const data = new FormData();
      data.set("file", file);
      const r = await uploadBackground(data);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Background updated");
      router.refresh();
    });
  const remove = () =>
    start(async () => {
      const r = await removeBackground();
      if (!r.ok) return void toast.error(r.error);
      toast.success("Background removed");
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${BACKGROUND_ROUTE}${encodeURIComponent(image)}`} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-4 text-muted-foreground" strokeWidth={1.75} />
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <LoaderCircle className="animate-spin" /> : <ImagePlus data-icon="inline-start" />}
          {image ? "Replace…" : "Choose image…"}
        </Button>
        {image && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove} className="text-muted-foreground">
            <Trash2 data-icon="inline-start" />
            Remove
          </Button>
        )}
      </div>

      <div className="space-y-2.5">
        {(Object.keys(BACKGROUND) as Key[]).map((key) => {
          const range = BACKGROUND[key];
          const id = `bg-${key}`;
          return (
            <div key={key} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-3">
              <label htmlFor={id} className={image ? "text-[0.8125rem]" : "text-[0.8125rem] text-muted-foreground"}>
                {range.label}
              </label>
              <input
                id={id}
                type="range"
                min={range.min}
                max={range.max}
                step={1}
                value={style[key]}
                disabled={!image}
                onChange={(e) => preview(key, Number(e.target.value))}
                onPointerUp={save}
                onKeyUp={save}
                className="h-1.5 w-full cursor-pointer accent-[var(--brand)] disabled:cursor-default disabled:opacity-40"
              />
              <span className="tabular text-right text-xs text-muted-foreground">
                {style[key]}
                {range.unit}
              </span>
            </div>
          );
        })}
      </div>
      {!image && <p className="text-xs text-muted-foreground">Choose an image to adjust blur, dim and card opacity.</p>}
    </div>
  );
}
