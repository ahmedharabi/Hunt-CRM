/*
 * Text size is stored in the settings table (settings.textScale) and applied
 * as the root font size. Everything is sized in rem, so it scales the whole UI.
 */

export const TEXT_SCALE = { min: 80, max: 150, step: 10, default: 100 } as const;

export const clampTextScale = (n: number) => Math.min(TEXT_SCALE.max, Math.max(TEXT_SCALE.min, Math.round(n)));

/* Background image (settings.backgroundImage + the three sliders below). */

export const BACKGROUND = {
  blur: { min: 0, max: 40, label: "Blur", unit: "px" },
  dim: { min: 0, max: 90, label: "Dim", unit: "%" },
  surface: { min: 40, max: 100, label: "Card opacity", unit: "%" },
} as const;
export type BackgroundStyle = Record<keyof typeof BACKGROUND, number>;

export const BACKGROUND_ROUTE = "/api/backgrounds/";
export const BACKGROUND_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

/** The CSS variables the background layer reads; the settings page sets them live while dragging. */
export function backgroundVars(s: BackgroundStyle): Record<string, string> {
  return { "--bg-blur": `${s.blur}px`, "--bg-dim": `${s.dim}%`, "--surface-alpha": `${s.surface}%` };
}

/**
 * With an image set: the page behind content turns transparent, and cards
 * and the sidebar become frosted panels whose opacity follows --surface-alpha.
 * Unlayered, so it beats Tailwind's (layered) utilities.
 */
export function backgroundCss(s: BackgroundStyle) {
  const vars = Object.entries(backgroundVars(s))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  const frosted = "background-color:color-mix(in oklab,var(--c) var(--surface-alpha),transparent);backdrop-filter:blur(12px)";
  return [
    `:root{${vars}}`,
    `[data-slot=sidebar-inset]{background-color:transparent}`,
    `[data-slot=sidebar-inner]{--c:var(--sidebar);${frosted}}`,
    `.bg-card{--c:var(--card);${frosted}}`,
  ].join("");
}
