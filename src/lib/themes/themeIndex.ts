// The list of color themes: ids, names and kinds only, so settings validation
// and the menus can use it without loading the palettes (themes/catalog.ts,
// imported lazily).

export type ThemeKind = "light" | "dark" | "high-contrast-light" | "high-contrast-dark";

/** Light or dark: which picker lists a theme and which data-theme it sets. */
export type ColorMode = "light" | "dark";

export interface ThemeInfo {
  id: string;
  name: string;
  kind: ThemeKind;
}

/** The built-in sets in src/app.css; they apply without loading the catalog. */
export const DEFAULT_LIGHT_THEME = "gm-light";
export const DEFAULT_DARK_THEME = "gm-dark";

export const THEME_INDEX: readonly ThemeInfo[] = [
  { id: DEFAULT_LIGHT_THEME, name: "Git Manager Light", kind: "light" },
  { id: "github-light", name: "GitHub Light", kind: "light" },
  { id: "one-light", name: "One Light", kind: "light" },
  { id: "solarized-light", name: "Solarized Light", kind: "light" },
  { id: "quiet-light", name: "Quiet Light", kind: "light" },
  { id: "ayu-light", name: "Ayu Light", kind: "light" },
  { id: "catppuccin-latte", name: "Catppuccin Latte", kind: "light" },
  { id: "gruvbox-light", name: "Gruvbox Light", kind: "light" },
  { id: "tokyo-night-day", name: "Tokyo Night Day", kind: "light" },
  { id: "rose-pine-dawn", name: "Rosé Pine Dawn", kind: "light" },
  { id: "intellij-light", name: "IntelliJ Light", kind: "light" },
  { id: DEFAULT_DARK_THEME, name: "Git Manager Dark", kind: "dark" },
  { id: "darcula", name: "Darcula", kind: "dark" },
  { id: "one-dark-pro", name: "One Dark Pro", kind: "dark" },
  { id: "dracula", name: "Dracula", kind: "dark" },
  { id: "monokai", name: "Monokai", kind: "dark" },
  { id: "monokai-pro", name: "Monokai Pro", kind: "dark" },
  { id: "nord", name: "Nord", kind: "dark" },
  { id: "solarized-dark", name: "Solarized Dark", kind: "dark" },
  { id: "github-dark", name: "GitHub Dark", kind: "dark" },
  { id: "github-dark-dimmed", name: "GitHub Dark Dimmed", kind: "dark" },
  { id: "gruvbox-dark", name: "Gruvbox Dark", kind: "dark" },
  { id: "tokyo-night", name: "Tokyo Night", kind: "dark" },
  { id: "catppuccin-mocha", name: "Catppuccin Mocha", kind: "dark" },
  { id: "catppuccin-macchiato", name: "Catppuccin Macchiato", kind: "dark" },
  { id: "ayu-dark", name: "Ayu Dark", kind: "dark" },
  { id: "ayu-mirage", name: "Ayu Mirage", kind: "dark" },
  { id: "material-palenight", name: "Material Palenight", kind: "dark" },
  { id: "night-owl", name: "Night Owl", kind: "dark" },
  { id: "cobalt2", name: "Cobalt2", kind: "dark" },
  { id: "rose-pine", name: "Rosé Pine", kind: "dark" },
  { id: "kanagawa", name: "Kanagawa", kind: "dark" },
  { id: "high-contrast-dark", name: "High Contrast Dark", kind: "high-contrast-dark" },
  { id: "github-dark-high-contrast", name: "GitHub Dark High Contrast", kind: "high-contrast-dark" },
  { id: "amber-high-contrast", name: "Amber High Contrast", kind: "high-contrast-dark" },
  { id: "high-contrast-light", name: "High Contrast Light", kind: "high-contrast-light" },
  { id: "github-light-high-contrast", name: "GitHub Light High Contrast", kind: "high-contrast-light" },
];

export function modeOfKind(kind: ThemeKind): ColorMode {
  return kind === "dark" || kind === "high-contrast-dark" ? "dark" : "light";
}

export function isHighContrast(kind: ThemeKind): boolean {
  return kind === "high-contrast-light" || kind === "high-contrast-dark";
}

export function themeInfo(themeId: string): ThemeInfo | null {
  return THEME_INDEX.find((theme) => theme.id === themeId) ?? null;
}

/** The light or dark mode in use: the Appearance setting, or macOS's when it is "system". */
export function effectiveMode(themeSetting: "system" | "light" | "dark", systemDark: boolean): ColorMode {
  if (themeSetting === "system") {
    return systemDark ? "dark" : "light";
  }
  return themeSetting;
}

export function defaultThemeFor(mode: ColorMode): string {
  return mode === "dark" ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
}

/** A saved theme id for `mode`'s picker; unknown ids and themes of the other mode fall back to the default. */
export function pickThemeId(value: unknown, mode: ColorMode): string {
  const theme = typeof value === "string" ? themeInfo(value) : null;
  return theme && modeOfKind(theme.kind) === mode ? theme.id : defaultThemeFor(mode);
}

export interface ThemeGroup {
  label: string;
  themes: ThemeInfo[];
}

/** What a picker lists: the regular themes of the mode, then its high contrast ones in their own group. */
export function themeGroups(mode: ColorMode): ThemeGroup[] {
  const ofMode = THEME_INDEX.filter((theme) => modeOfKind(theme.kind) === mode);
  return [
    { label: mode === "dark" ? "Dark" : "Light", themes: ofMode.filter((theme) => !isHighContrast(theme.kind)) },
    { label: "High contrast", themes: ofMode.filter((theme) => isHighContrast(theme.kind)) },
  ];
}

/**
 * Listbox keys: the index of the theme to select after `key`, or null when
 * the key does not move. Page keys jump by `pageSize`.
 */
export function pickerMove(currentIndex: number, key: string, count: number, pageSize = 8): number | null {
  if (count <= 0) {
    return null;
  }
  const last = count - 1;
  const from = Math.min(last, Math.max(0, currentIndex));
  switch (key) {
    case "ArrowDown":
      return Math.min(last, currentIndex < 0 ? 0 : from + 1);
    case "ArrowUp":
      return Math.max(0, currentIndex < 0 ? last : from - 1);
    case "Home":
      return 0;
    case "End":
      return last;
    case "PageDown":
      return Math.min(last, from + pageSize);
    case "PageUp":
      return Math.max(0, from - pageSize);
    default:
      return null;
  }
}
