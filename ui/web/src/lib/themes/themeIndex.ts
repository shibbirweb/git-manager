// The list of color themes: ids, names and kinds only (ui/design-tokens/themes/index.json), so settings
// validation and the menus can use it without loading the palettes (catalog.ts, imported lazily).

import indexJson from "../../../../design-tokens/themes/index.json";

export type ThemeKind = "light" | "dark" | "high-contrast-light" | "high-contrast-dark";

/** Light or dark: which picker lists a theme and which data-theme it sets. */
export type ColorMode = "light" | "dark";

export interface ThemeInfo {
  id: string;
  name: string;
  kind: ThemeKind;
}

/** The built-in sets (colors.json, styles/colors.css); they apply without loading the catalog. */
export const DEFAULT_LIGHT_THEME = "gm-light";
export const DEFAULT_DARK_THEME = "gm-dark";

export const THEME_INDEX: readonly ThemeInfo[] = indexJson.themes as ThemeInfo[];

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
