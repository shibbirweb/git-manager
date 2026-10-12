// A DataTable column: its header label, a named width (or the rest of the row), and how its cells read.
import type { Tone } from "./scale";

export interface DataColumn {
  id: string;
  label: string;
  width: "fill" | "xsmall" | "small" | "side" | "medium" | "large";
  tone?: Tone;
  mono?: boolean;
  small?: boolean;
}

/** A cell's text when the table has no `cell` snippet: the row's value under the column's id. */
export function cellText(row: unknown, column: DataColumn): string {
  const value = (row as Record<string, unknown> | null)?.[column.id];
  return value === undefined || value === null ? "" : String(value);
}
