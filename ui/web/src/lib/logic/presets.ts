// The named presets props use instead of numbers: every size, width, height and count a component can take comes
// from the design tokens by name, so no screen can pass a custom value.
import { scales } from "../styles/tokens";

export type IconSize = keyof typeof scales.iconSize;
/** Icon line weights; `heavy` is only for the dotted "more" icon, which sets it itself. */
export type IconStroke = Exclude<keyof typeof scales.iconStroke, "heavy">;
export type ControlWidth = keyof typeof scales.controlWidth | "auto" | "fill";
export type PopoverWidth = keyof typeof scales.popoverWidth | "auto";
export type DialogWidth = keyof typeof scales.dialogWidth;
export type ViewHeight = keyof typeof scales.viewHeight | "fill";
export type ColumnWidth = keyof typeof scales.columnWidth;
export type RowHeight = keyof typeof scales.rowHeight;
export type TextRows = keyof typeof scales.textRows;
export type PanelPreset = keyof typeof scales.panelMin;
export type CodeHeight = keyof typeof scales.codeHeight | "none";
export type GridColumns = "auto" | "two" | "three" | "four" | "six";
export type LabelColumn = keyof typeof scales.labelColumn;

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** A preset as its CSS variable, e.g. presetVar("controlWidth", "medium") is var(--control-width-medium). */
export function presetVar(scale: string, name: string): string {
  return `var(--${kebab(scale)}-${kebab(name)})`;
}

export function iconPx(size: IconSize): number {
  return scales.iconSize[size];
}

/** A control's CSS width: auto, the parent's full width, or a named width. */
export function controlWidth(width: ControlWidth): string {
  if (width === "auto") {
    return "auto";
  }
  return width === "fill" ? "100%" : presetVar("controlWidth", width);
}

export const GRID_COLUMNS: Record<Exclude<GridColumns, "auto">, number> = { two: 2, three: 3, four: 4, six: 6 };
