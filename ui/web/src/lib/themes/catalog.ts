// Color themes as token values: the built-in Nibtree Light and Dark sets (colors.json, styles/colors.css)
// and every other theme derived from its published colors (palettes.ts, derive.ts). Imported lazily (Settings >
// Editor, or when a non-default theme is active) so the defaults cost nothing. Values are computed on demand and
// never cached, so only the applied CSS variables stay around.

import colorsJson from "../../../../design-tokens/colors.json";
import { COLOR_TOKENS, type ColorToken, type ThemeColors } from "./colorTokens";
import { deriveColors, SHADOW_DARK, SHADOW_LIGHT } from "./derive";
import { themeSpec } from "./palettes";
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, modeOfKind, THEME_INDEX, themeInfo } from "./themeIndex";

/** The built-in light or dark set: colors.json's values (styles/colors.css) and the popup shadow. */
function builtInColors(mode: "light" | "dark"): ThemeColors {
  const source = colorsJson as Record<string, unknown>;
  const read = (token: ColorToken): string => {
    if (token === "--shadow") {
      return mode === "dark" ? SHADOW_DARK : SHADOW_LIGHT;
    }
    const value = source[token.slice(2)] as Record<string, string> | undefined;
    return value?.[mode] ?? "";
  };
  return Object.fromEntries(COLOR_TOKENS.map((token) => [token, read(token)])) as ThemeColors;
}

/** Every token's value for a theme; null for an unknown id. Computed each call, nothing is kept. */
export function themeColors(themeId: string): ThemeColors | null {
  if (themeId === DEFAULT_LIGHT_THEME) {
    return builtInColors("light");
  }
  if (themeId === DEFAULT_DARK_THEME) {
    return builtInColors("dark");
  }
  const info = themeInfo(themeId);
  const spec = themeSpec(themeId);
  return info && spec ? deriveColors(info.kind, spec) : null;
}

/** Ids with a palette, in THEME_INDEX order (the tests check every listed theme has one). */
export function catalogThemeIds(): string[] {
  return THEME_INDEX.map((theme) => theme.id).filter(
    (themeId) => themeId === DEFAULT_LIGHT_THEME || themeId === DEFAULT_DARK_THEME || themeSpec(themeId) !== null,
  );
}

/**
 * The CSS rule for a theme, scoped to data-color-theme so it can only apply
 * together with the attribute. `html:root` outranks colors.css's `:root[data-theme]`.
 */
export function themeCss(themeId: string): string | null {
  const info = themeInfo(themeId);
  const colors = themeColors(themeId);
  if (!info || !colors) {
    return null;
  }
  const lines = COLOR_TOKENS.map((token) => `  ${token}: ${colors[token]};`);
  lines.push(`  color-scheme: ${modeOfKind(info.kind)};`);
  return `html:root[data-color-theme="${themeId}"] {\n${lines.join("\n")}\n}\n`;
}

/** The few colors a picker swatch shows. */
export interface ThemeSwatch {
  background: string;
  foreground: string;
  keyword: string;
  string: string;
  selection: string;
  accent: string;
  border: string;
}

export function themeSwatch(themeId: string): ThemeSwatch | null {
  const colors = themeColors(themeId);
  if (!colors) {
    return null;
  }
  return {
    background: colors["--editor-bg"],
    foreground: colors["--text"],
    keyword: colors["--tok-keyword"],
    string: colors["--tok-string"],
    selection: colors["--editor-selection"],
    accent: colors["--accent"],
    border: colors["--border-strong"],
  };
}
