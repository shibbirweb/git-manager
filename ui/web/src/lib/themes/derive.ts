// A color theme's full token set from the colors it publishes (ui/design-tokens/themes): panels, borders, hover,
// selection and diff tints are mixed from the editor colors with logic/color.ts and kept legible. The token
// generator runs the same code to write every theme for the native apps, so all platforms match.

import {
  colorDistance,
  composite,
  contrastRatio,
  ensureContrast,
  fitTint,
  luminance,
  mix,
  withAlpha,
} from "../logic/color";
import type { ThemeColors } from "./colorTokens";
import { isHighContrast, modeOfKind, type ThemeKind } from "./themeIndex";

/** black, red, green, yellow, blue, magenta, cyan, white, then the bright variants. */
export type Ansi = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

export interface Syntax {
  keyword: string;
  string: string;
  number: string;
  comment: string;
  type: string;
  function: string;
  property: string;
  meta?: string;
  tag?: string;
  attr?: string;
  invalid?: string;
  /** true, false, null; the keyword color when unset. */
  constant?: string;
  /** =, +, ==; the text color when unset. */
  operator?: string;
}

export interface ThemeSpec {
  /** Editor background. */
  background: string;
  /** Editor and UI text. */
  foreground: string;
  accent: string;
  /** Editor selection; may be translucent, it is painted over the background. */
  selection: string;
  ansi: Ansi;
  syntax: Syntax;
  /** Published UI colors, where the theme has them; everything else is derived. */
  ui?: {
    bg?: string;
    panel?: string;
    panelAlt?: string;
    border?: string;
    borderStrong?: string;
    lineNumber?: string;
    activeLine?: string;
    cursor?: string;
    /** Git status and diff colors when the ANSI ones do not fit (Rosé Pine has no green). */
    success?: string;
    danger?: string;
    warning?: string;
    info?: string;
  };
}

/** How far (CIELAB distance) the frame behind rounded panels must be from the panels, or the gaps disappear. */
const FRAME_DISTANCE = 5;

export const SHADOW_LIGHT = "0 8px 28px rgba(0, 0, 0, 0.16)";
export const SHADOW_DARK = "0 8px 28px rgba(0, 0, 0, 0.5)";

/**
 * The window color behind rounded panels: the theme's own background when it
 * differs enough from the panels and the editor (the editor is an island too),
 * else the darker of the two darkened (dark themes) or the panel greyed (light
 * themes), and as a last resort moved toward the text.
 */
function frameColor(bg: string, panel: string, editorBg: string, text: string, dark: boolean): string {
  const apart = (color: string) =>
    colorDistance(color, panel) >= FRAME_DISTANCE && colorDistance(color, editorBg) >= FRAME_DISTANCE;
  // Dark themes shade the darker island, so the frame sits below both.
  const base = dark && luminance(editorBg) < luminance(panel) ? editorBg : panel;
  const shaded = dark ? mix(base, "#000000", 0.35) : mix(base, text, 0.08);
  const candidates = [bg, shaded, mix(panel, text, 0.12), mix(editorBg, text, 0.12)];
  return candidates.find(apart) ?? mix(panel, text, 0.12);
}

/** Every token of a theme from its published colors: the UI shades are mixed from them and kept legible. */
export function deriveColors(kind: ThemeKind, spec: ThemeSpec): ThemeColors {
  const dark = modeOfKind(kind) === "dark";
  const high = isHighContrast(kind);
  const ui = spec.ui ?? {};
  const [, red, green, yellow, blue, magenta, , , , brightRed, brightGreen, brightYellow, brightBlue, brightMagenta] =
    spec.ansi;
  const editorBg = spec.background;
  const text = spec.foreground;
  const panel = ui.panel ?? (dark ? mix(editorBg, text, 0.05) : editorBg);
  const panelAlt = ui.panelAlt ?? (dark ? mix(editorBg, text, 0.025) : mix(editorBg, text, 0.035));
  const bg = ui.bg ?? (dark ? editorBg : mix(editorBg, text, 0.025));
  const frame = frameColor(bg, panel, editorBg, text, dark);
  const textMinimum = high ? 7 : 4.5;
  // Hints and status colors must read on every surface they sit on.
  const legible = (color: string, minimum: number) =>
    ensureContrast(ensureContrast(ensureContrast(color, panel, minimum), bg, minimum), frame, minimum);
  const accent = legible(spec.accent, high ? 4.5 : 3);
  // Project tiles (Avatar.svelte) shade red, green, blue, magenta and cyan towards the terminal black, which is
  // light in some light themes: their letters take whichever of white and black reads better on the worst of the five.
  const tiles = [1, 2, 4, 5, 6].map((index) => mix(spec.ansi[index], spec.ansi[0], 0.28));
  const worstOnTiles = (candidate: string) => Math.min(...tiles.map((tile) => contrastRatio(candidate, tile)));
  const avatarText = worstOnTiles("#ffffff") >= worstOnTiles("#000000") ? "#ffffff" : "#000000";
  const success = legible(ui.success ?? (dark ? brightGreen : green), high ? 4.5 : 3);
  const danger = legible(ui.danger ?? (dark ? brightRed : red), high ? 4.5 : 3);
  const warning = legible(ui.warning ?? (dark ? brightYellow : yellow), high ? 4.5 : 3);
  // Mid blues score a little higher with black than with white, yet white reads better on them and is what the source
  // apps use, so button text is white whenever it reaches 3:1 on the accent.
  const darkText = dark ? editorBg : "#000000";
  const whiteOnAccent = contrastRatio("#ffffff", accent);
  const accentText = whiteOnAccent >= 3 || whiteOnAccent >= contrastRatio(darkText, accent) ? "#ffffff" : darkText;
  const info = ui.info ?? (dark ? brightBlue : blue);
  const textDim = legible(mix(text, panel, 0.35), textMinimum);
  const selection = composite(spec.selection, editorBg);
  const grey = mix(text, editorBg, 0.5);
  // High contrast themes get stronger diff tints so changed lines stand out.
  const tint = (dark ? 1 : 0.8) * (high ? 1.6 : 1);
  const diffTint = (color: string, alpha: number) => fitTint(color, editorBg, text, alpha * tint, 4.5);
  const syntax = (color: string) => (high ? ensureContrast(color, editorBg, 7) : color);
  const bracket = (color: string) => ensureContrast(color, editorBg, high ? 7 : 3);
  return {
    "--bg": bg,
    "--frame": frame,
    "--panel": panel,
    "--panel-alt": panelAlt,
    "--border": ui.border ?? (dark ? mix(panel, "#000000", 0.3) : mix(panel, text, 0.07)),
    "--border-strong": ui.borderStrong ?? mix(panel, text, dark ? 0.1 : 0.13),
    "--text": text,
    "--text-dim": textDim,
    "--text-faint": legible(mix(text, panel, 0.6), high ? 4.5 : 2),
    "--accent": accent,
    "--accent-hover": mix(accent, dark ? "#ffffff" : "#000000", 0.12),
    "--accent-text": accentText,
    "--avatar-text": avatarText,
    "--hover": mix(panel, text, high ? 0.16 : dark ? 0.08 : 0.06),
    "--selected": composite(fitTint(accent, panel, text, dark ? 0.3 : 0.18, textMinimum), panel),
    "--selected-inactive": mix(panel, text, dark ? 0.1 : 0.09),
    "--danger": danger,
    "--success": success,
    "--warning": warning,
    "--shadow": dark ? SHADOW_DARK : SHADOW_LIGHT,
    "--overlay": dark ? "rgba(0, 0, 0, 0.45)" : "rgba(0, 0, 0, 0.28)",
    "--editor-bg": editorBg,
    "--editor-gutter": editorBg,
    "--editor-line-number": ensureContrast(ui.lineNumber ?? mix(text, editorBg, 0.6), editorBg, high ? 4.5 : 1.8),
    "--editor-active-line": ui.activeLine ?? mix(editorBg, text, dark ? 0.04 : 0.035),
    "--editor-selection": selection,
    "--editor-cursor": ui.cursor ?? text,
    "--term-background": editorBg,
    "--term-foreground": text,
    "--term-cursor": ui.cursor ?? text,
    "--term-selection": selection,
    "--term-black": spec.ansi[0],
    "--term-red": spec.ansi[1],
    "--term-green": spec.ansi[2],
    "--term-yellow": spec.ansi[3],
    "--term-blue": spec.ansi[4],
    "--term-magenta": spec.ansi[5],
    "--term-cyan": spec.ansi[6],
    "--term-white": spec.ansi[7],
    "--term-bright-black": spec.ansi[8],
    "--term-bright-red": spec.ansi[9],
    "--term-bright-green": spec.ansi[10],
    "--term-bright-yellow": spec.ansi[11],
    "--term-bright-blue": spec.ansi[12],
    "--term-bright-magenta": spec.ansi[13],
    "--term-bright-cyan": spec.ansi[14],
    "--term-bright-white": spec.ansi[15],
    "--term-scrollbar": withAlpha(textDim, 0.35),
    "--term-scrollbar-hover": withAlpha(textDim, 0.55),
    "--diff-modified": diffTint(info, 0.17),
    "--diff-modified-edge": info,
    "--diff-added": diffTint(success, 0.2),
    "--diff-added-edge": success,
    "--diff-deleted": diffTint(grey, 0.25),
    "--diff-deleted-edge": mix(text, editorBg, 0.45),
    "--diff-conflict": diffTint(danger, 0.2),
    "--diff-conflict-edge": danger,
    "--diff-inline": diffTint(info, 0.35),
    "--diff-removed": diffTint(danger, 0.18),
    "--diff-removed-word": diffTint(danger, 0.36),
    "--diff-added-word": diffTint(success, 0.4),
    "--tok-keyword": syntax(spec.syntax.keyword),
    "--tok-string": syntax(spec.syntax.string),
    "--tok-number": syntax(spec.syntax.number),
    "--tok-comment": syntax(spec.syntax.comment),
    "--tok-type": syntax(spec.syntax.type),
    "--tok-function": syntax(spec.syntax.function),
    "--tok-property": syntax(spec.syntax.property),
    "--tok-meta": syntax(spec.syntax.meta ?? spec.syntax.number),
    "--tok-tag": syntax(spec.syntax.tag ?? spec.syntax.keyword),
    "--tok-attr": syntax(spec.syntax.attr ?? spec.syntax.property),
    "--tok-invalid": syntax(spec.syntax.invalid ?? danger),
    "--tok-constant": syntax(spec.syntax.constant ?? spec.syntax.keyword),
    "--tok-operator": syntax(spec.syntax.operator ?? text),
    // Bracket depth colors from the terminal palette: gold, orchid and blue.
    "--bracket-1": bracket(dark ? brightYellow : blue),
    "--bracket-2": bracket(dark ? brightMagenta : green),
    "--bracket-3": bracket(dark ? brightBlue : magenta),
  };
}
