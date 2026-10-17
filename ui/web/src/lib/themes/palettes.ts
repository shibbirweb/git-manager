// The published colors of every color theme, from ui/design-tokens/themes (one file per kind, split to stay
// within 300 lines). A theme's "ansi" is its own 16 colors or the name of a shared set in ansi.json.

import ansiJson from "../../../../design-tokens/themes/ansi.json";
import darkJson from "../../../../design-tokens/themes/dark.json";
import darkMoreJson from "../../../../design-tokens/themes/dark-2.json";
import highContrastJson from "../../../../design-tokens/themes/high-contrast.json";
import lightJson from "../../../../design-tokens/themes/light.json";
import type { Ansi, ThemeSpec } from "./derive";

/** A theme as the JSON writes it: a note for people, and ansi as colors or a shared set's name. */
type ThemeSource = Omit<ThemeSpec, "ansi"> & { $note?: string | string[]; ansi: string | string[] };

const SOURCES: Record<string, ThemeSource> = withoutComments([lightJson, darkJson, darkMoreJson, highContrastJson]);
const SHARED_ANSI = ansiJson as Record<string, unknown>;

function withoutComments(files: object[]): Record<string, ThemeSource> {
  const themes: Record<string, ThemeSource> = {};
  for (const file of files) {
    for (const [themeId, source] of Object.entries(file)) {
      if (themeId !== "$comment") {
        themes[themeId] = source as ThemeSource;
      }
    }
  }
  return themes;
}

function ansiOf(themeId: string, ansi: string | string[]): Ansi {
  const colors = typeof ansi === "string" ? SHARED_ANSI[ansi] : ansi;
  if (!Array.isArray(colors) || colors.length !== 16) {
    throw new Error(`${themeId}: ansi must be 16 colors or a set in ansi.json, not ${JSON.stringify(ansi)}`);
  }
  return colors as Ansi;
}

/** A theme's published colors; null for the built-in sets and unknown ids. */
export function themeSpec(themeId: string): ThemeSpec | null {
  const source = SOURCES[themeId];
  if (!source) {
    return null;
  }
  const { $note: _note, ansi, ...colors } = source;
  return { ...colors, ansi: ansiOf(themeId, ansi) };
}

/** Ids with a palette file entry, in file order. */
export function paletteIds(): string[] {
  return Object.keys(SOURCES);
}
