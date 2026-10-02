// Terminal font options, kept free of Svelte and xterm so they can be tested
// directly: the font-family stack (with optional Nerd Font fallbacks) and the
// weights xterm understands.

import { MONOSPACE_FONTS, normalizeFontFamily, type TerminalFontWeight } from "$lib/stores/settingsData";

/**
 * Fonts that carry the Nerd Font and Powerline icons used by prompts such as
 * Powerlevel10k, Starship and oh-my-posh. The icons sit in the Unicode private
 * use area, which the macOS font fallback never searches, so they only show
 * when a font that has them is named in the list. Mono variants come first:
 * their icons fit a single cell.
 */
export const NERD_FONT_FALLBACKS = [
  "Symbols Nerd Font Mono",
  "Symbols Nerd Font",
  "MesloLGS NF",
  "MesloLGS Nerd Font Mono",
  "MesloLGS Nerd Font",
  "JetBrainsMono Nerd Font Mono",
  "JetBrainsMono Nerd Font",
  "Hack Nerd Font Mono",
  "Hack Nerd Font",
  "FiraCode Nerd Font Mono",
  "FiraCode Nerd Font",
];

/** Font chips in Settings > Terminal: the editor's list plus the font Powerlevel10k recommends. */
export const TERMINAL_FONT_PICKS = [...MONOSPACE_FONTS, "MesloLGS NF"];

const GENERIC_MONOSPACE = "monospace";

/** A family name without quotes, lower case, for comparing entries. */
function familyKey(family: string): string {
  return family.trim().replace(/^(['"])(.*)\1$/, "$2").trim().toLowerCase();
}

function quoteFamily(family: string): string {
  return /\s/.test(family) ? `'${family}'` : family;
}

export interface TerminalFontInput {
  /** The terminal font setting; empty uses the editor font. */
  terminalFontFamily: string;
  editorFontFamily: string;
  /** Add the Nerd Font fallbacks after the chosen fonts. */
  nerdFontIcons: boolean;
}

/**
 * The CSS font-family list the terminal renders with: the terminal font (or
 * the editor font when it is empty), then the Nerd Font fallbacks that are not
 * already listed, then the generic monospace last.
 */
export function buildTerminalFontFamily(input: TerminalFontInput): string {
  const chosen = (input.terminalFontFamily ?? "").trim() || (input.editorFontFamily ?? "");
  const families = normalizeFontFamily(chosen)
    .split(",")
    .map((family) => family.trim())
    .filter((family) => family && familyKey(family) !== GENERIC_MONOSPACE);
  if (input.nerdFontIcons) {
    const listed = new Set(families.map(familyKey));
    for (const fallback of NERD_FONT_FALLBACKS) {
      if (!listed.has(familyKey(fallback))) {
        families.push(quoteFamily(fallback));
      }
    }
  }
  families.push(GENERIC_MONOSPACE);
  return families.join(", ");
}

/** xterm's FontWeight values, mirrored so this module does not import xterm. */
export type XtermFontWeight = "normal" | "bold" | "500";

const XTERM_WEIGHTS: Record<TerminalFontWeight, XtermFontWeight> = {
  normal: "normal",
  medium: "500",
  bold: "bold",
};

/** The xterm fontWeight (also a valid CSS font-weight) for a setting; unknown values read as normal. */
export function xtermFontWeight(weight: TerminalFontWeight): XtermFontWeight {
  return XTERM_WEIGHTS[weight] ?? "normal";
}
