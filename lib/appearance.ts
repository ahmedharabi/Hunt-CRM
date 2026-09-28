/*
 * Text size is stored in the settings table (settings.textScale) and applied
 * as the root font size. Everything is sized in rem, so it scales the whole UI.
 */

export const TEXT_SCALE = { min: 80, max: 150, step: 10, default: 100 } as const;

export const clampTextScale = (n: number) => Math.min(TEXT_SCALE.max, Math.max(TEXT_SCALE.min, Math.round(n)));
