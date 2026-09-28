/*
 * Color themes (settings.colorTheme). Each theme has a light and a dark
 * flavor, picked by the Light/Dark/System switch. Values are the themes'
 * official palettes. A theme only replaces the neutral surfaces and the brand
 * accent; status and activity colors stay fixed so they read the same
 * everywhere.
 */

type Flavor = {
  name: string;
  /** Page background. */
  bg: string;
  /** Cards. */
  surface: string;
  /** Popovers, menus, dialogs. */
  raised: string;
  sidebar: string;
  /** Muted fills: hovers, secondary buttons, inputs. */
  subtle: string;
  border: string;
  fg: string;
  fgMuted: string;
  accent: string;
  /** Text on the accent. */
  accentFg: string;
  danger: string;
};

export type ColorTheme = { id: string; label: string; light: Flavor; dark: Flavor };

export const COLOR_THEMES = [
  {
    id: "tokyo-night",
    label: "Tokyo Night",
    light: {
      name: "Day",
      bg: "#e1e2e7",
      surface: "#e9e9ed",
      raised: "#eeeef2",
      sidebar: "#d0d5e3",
      subtle: "#d5d8e3",
      border: "#c4c8da",
      fg: "#3760bf",
      fgMuted: "#6172b0",
      accent: "#2e7de9",
      accentFg: "#e1e2e7",
      danger: "#f52a65",
    },
    dark: {
      name: "Night",
      bg: "#1a1b26",
      surface: "#1f2335",
      raised: "#24283b",
      sidebar: "#16161e",
      subtle: "#292e42",
      border: "#2f334d",
      fg: "#c0caf5",
      fgMuted: "#737aa2",
      accent: "#7aa2f7",
      accentFg: "#1a1b26",
      danger: "#f7768e",
    },
  },
  {
    id: "catppuccin",
    label: "Catppuccin",
    light: {
      name: "Latte",
      bg: "#e6e9ef",
      surface: "#eff1f5",
      raised: "#eff1f5",
      sidebar: "#dce0e8",
      subtle: "#ccd0da",
      border: "#ccd0da",
      fg: "#4c4f69",
      fgMuted: "#6c6f85",
      accent: "#8839ef",
      accentFg: "#eff1f5",
      danger: "#d20f39",
    },
    dark: {
      name: "Mocha",
      bg: "#181825",
      surface: "#1e1e2e",
      raised: "#1e1e2e",
      sidebar: "#11111b",
      subtle: "#313244",
      border: "#313244",
      fg: "#cdd6f4",
      fgMuted: "#a6adc8",
      accent: "#cba6f7",
      accentFg: "#11111b",
      danger: "#f38ba8",
    },
  },
  {
    id: "rose-pine",
    label: "Rosé Pine",
    light: {
      name: "Dawn",
      bg: "#faf4ed",
      surface: "#fffaf3",
      raised: "#fffaf3",
      sidebar: "#f2e9e1",
      subtle: "#f2e9e1",
      border: "#dfdad9",
      fg: "#575279",
      fgMuted: "#797593",
      accent: "#d7827e",
      accentFg: "#575279",
      danger: "#b4637a",
    },
    dark: {
      name: "Main",
      bg: "#191724",
      surface: "#1f1d2e",
      raised: "#26233a",
      sidebar: "#191724",
      subtle: "#26233a",
      border: "#403d52",
      fg: "#e0def4",
      fgMuted: "#908caa",
      accent: "#ebbcba",
      accentFg: "#191724",
      danger: "#eb6f92",
    },
  },
  {
    id: "nord",
    label: "Nord",
    light: {
      name: "Snow Storm",
      bg: "#e5e9f0",
      surface: "#eceff4",
      raised: "#eceff4",
      sidebar: "#d8dee9",
      subtle: "#d8dee9",
      border: "#d8dee9",
      fg: "#2e3440",
      fgMuted: "#4c566a",
      accent: "#5e81ac",
      accentFg: "#eceff4",
      danger: "#bf616a",
    },
    dark: {
      name: "Polar Night",
      bg: "#2e3440",
      surface: "#3b4252",
      raised: "#3b4252",
      sidebar: "#2e3440",
      subtle: "#434c5e",
      border: "#434c5e",
      fg: "#eceff4",
      fgMuted: "#a5b1c2",
      accent: "#88c0d0",
      accentFg: "#2e3440",
      danger: "#bf616a",
    },
  },
  {
    id: "gruvbox",
    label: "Gruvbox",
    light: {
      name: "Light",
      bg: "#fbf1c7",
      surface: "#f9f5d7",
      raised: "#f9f5d7",
      sidebar: "#f2e5bc",
      subtle: "#ebdbb2",
      border: "#d5c4a1",
      fg: "#3c3836",
      fgMuted: "#7c6f64",
      accent: "#af3a03",
      accentFg: "#fbf1c7",
      danger: "#9d0006",
    },
    dark: {
      name: "Dark",
      bg: "#282828",
      surface: "#32302f",
      raised: "#3c3836",
      sidebar: "#1d2021",
      subtle: "#3c3836",
      border: "#3c3836",
      fg: "#ebdbb2",
      fgMuted: "#a89984",
      accent: "#fe8019",
      accentFg: "#282828",
      danger: "#fb4934",
    },
  },
] as const satisfies readonly ColorTheme[];

export const COLOR_THEME_IDS = ["default", ...COLOR_THEMES.map((t) => t.id)] as [string, ...string[]];

function tokens(f: Flavor) {
  const vars: Record<string, string> = {
    background: f.bg,
    foreground: f.fg,
    card: f.surface,
    "card-foreground": f.fg,
    popover: f.raised,
    "popover-foreground": f.fg,
    primary: f.fg,
    "primary-foreground": f.bg,
    secondary: f.subtle,
    "secondary-foreground": f.fg,
    muted: f.subtle,
    "muted-foreground": f.fgMuted,
    accent: f.subtle,
    "accent-foreground": f.fg,
    destructive: f.danger,
    border: f.border,
    input: f.border,
    ring: f.accent,
    brand: f.accent,
    "brand-foreground": f.accentFg,
    "brand-soft": `color-mix(in oklab, ${f.accent} 16%, transparent)`,
    sidebar: f.sidebar,
    "sidebar-foreground": f.fg,
    "sidebar-primary": f.accent,
    "sidebar-primary-foreground": f.accentFg,
    "sidebar-accent": f.subtle,
    "sidebar-accent-foreground": f.fg,
    "sidebar-border": f.border,
    "sidebar-ring": f.accent,
  };
  return Object.entries(vars)
    .map(([k, v]) => `--${k}:${v};`)
    .join("");
}

/**
 * CSS for the chosen theme, or null for the built-in one. The doubled
 * selectors outrank the defaults in globals.css (:root and .dark).
 */
export function colorThemeCss(id: string) {
  const theme = COLOR_THEMES.find((t) => t.id === id);
  if (!theme) return null;
  return `html:root{${tokens(theme.light)}}html:root.dark{${tokens(theme.dark)}}`;
}
